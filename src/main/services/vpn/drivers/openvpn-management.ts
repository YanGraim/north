import { parseCidr } from '@shared/lib/vpn/cidr'

/** Pure parser for the OpenVPN management interface protocol (no sockets here). */
export type ManagementEvent =
  | { type: 'password-prompt' }
  | { type: 'hold' }
  | { type: 'need-password'; realm: string; needsUsername: boolean }
  | { type: 'verification-failed'; realm: string }
  | { type: 'state'; state: string; detail: string; localIp?: string; remoteIp?: string }
  | { type: 'log'; message: string }
  | { type: 'fatal'; message: string }
  | { type: 'info'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | { type: 'other'; line: string }

export function parseManagementLine(line: string): ManagementEvent {
  if (line.startsWith('ENTER PASSWORD:')) return { type: 'password-prompt' }
  if (line.startsWith('SUCCESS:')) return { type: 'success', message: line.slice(8).trim() }
  if (line.startsWith('ERROR:')) return { type: 'error', message: line.slice(6).trim() }
  if (!line.startsWith('>')) return { type: 'other', line }

  const colon = line.indexOf(':')
  const kind = line.slice(1, colon)
  const body = line.slice(colon + 1)

  switch (kind) {
    case 'HOLD':
      return { type: 'hold' }
    case 'INFO':
      return { type: 'info', message: body }
    case 'FATAL':
      return { type: 'fatal', message: body }
    case 'LOG': {
      // >LOG:{timestamp},{flags},{message}
      const parts = body.split(',')
      return { type: 'log', message: parts.slice(2).join(',') }
    }
    case 'STATE': {
      // >STATE:{time},{state},{detail},{local ip},{remote ip},{remote port},...
      const [, state = '', detail = '', localIp, remoteIp] = body.split(',')
      return {
        type: 'state',
        state,
        detail,
        ...(localIp ? { localIp } : {}),
        ...(remoteIp ? { remoteIp } : {})
      }
    }
    case 'PASSWORD': {
      const failed = /^Verification Failed: '([^']+)'/.exec(body)
      if (failed) return { type: 'verification-failed', realm: failed[1] }
      const need = /^Need '([^']+)' (username\/password|password)/.exec(body)
      if (need) {
        return { type: 'need-password', realm: need[1], needsUsername: need[2] !== 'password' }
      }
      return { type: 'other', line }
    }
    default:
      return { type: 'other', line }
  }
}

export type PushReply = { routes: string[]; localIp?: string; redirectGateway: boolean }

/** Extract routes/ifconfig from the `PUSH_REPLY` log message. */
export function parsePushReply(message: string): PushReply | null {
  const match = /PUSH_REPLY,([^']*)/.exec(message)
  if (!match) return null
  const reply: PushReply = { routes: [], redirectGateway: false }
  for (const option of match[1].split(',')) {
    const [name, a, b] = option.trim().split(/\s+/)
    if (name === 'route' && a) {
      const cidr = parseCidr(b && /^\d/.test(b) ? `${a} ${b}` : a)
      if (cidr) reply.routes.push(`${a}/${cidr.prefix}`)
    } else if (name === 'ifconfig' && a) {
      reply.localIp = a
    } else if (name === 'redirect-gateway') {
      reply.redirectGateway = true
    }
  }
  return reply
}

/** Quote an argument for a management command (`password "Auth" "<value>"`). */
export function quoteManagementArg(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('Management argument must not contain line breaks')
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Line splitter for the management socket. `ENTER PASSWORD:` arrives without a newline. */
export class ManagementLineBuffer {
  private pending = ''

  push(chunk: string): string[] {
    this.pending += chunk
    const lines = this.pending.split(/\r?\n/)
    this.pending = lines.pop() ?? ''
    if (this.pending.startsWith('ENTER PASSWORD:')) {
      lines.push(this.pending)
      this.pending = ''
    }
    return lines.filter((l) => l.length > 0)
  }
}
