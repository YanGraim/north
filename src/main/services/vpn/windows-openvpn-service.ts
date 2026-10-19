import { connect, type Socket } from 'node:net'
import type { LaunchedProcess, LaunchResult, PrivilegeBroker } from './privilege-broker'
import { VpnError } from './vpn-error'

/**
 * Windows: OpenVPN's Interactive Service (installed with OpenVPN, runs as SYSTEM) starts
 * openvpn.exe as the calling user and does the privileged parts (routes, DNS, adapter)
 * itself — the Windows counterpart of North's root helper, with no prompt per connection.
 * Members of the local Administrators or "OpenVPN Administrators" groups may pass any
 * options and config path; North still keeps its own config checks before launching.
 *
 * Protocol (openvpnserv/interactive.c): connect to the pipe, write UTF-16LE
 * "workdir\0options\0stdin\0"; the service answers "0x00000000\n0x<pid>\nProcess ID" or
 * "0x<error>\n<function>\n<message>", and keeps the pipe open until openvpn.exe exits.
 */
export const OPENVPN_SERVICE_PIPE = '\\\\.\\pipe\\openvpn\\service'

/** One argument for CommandLineToArgvW (MSVC rules: backslashes only matter before a quote). */
export function winQuoteArg(arg: string): string {
  if (arg !== '' && !/[\s"]/.test(arg)) return arg
  let out = '"'
  let slashes = 0
  for (const ch of arg) {
    if (ch === '\\') {
      slashes++
      continue
    }
    if (ch === '"') {
      out += `${'\\'.repeat(slashes * 2 + 1)}"`
    } else {
      out += `${'\\'.repeat(slashes)}${ch}`
    }
    slashes = 0
  }
  return `${out}${'\\'.repeat(slashes * 2)}"`
}

export function buildStartupMessage(workdir: string, args: string[], stdin = ''): Buffer {
  for (const part of [workdir, stdin, ...args]) {
    if (part.includes('\0')) throw new Error('Startup data must not contain NUL')
  }
  const options = args.map(winQuoteArg).join(' ')
  return Buffer.from(`${workdir}\0${options}\0${stdin}\0`, 'utf16le')
}

export type ServiceReply = { pid: number } | { error: string }

export function parseServiceReply(text: string): ServiceReply | null {
  const lines = text.replace(/\0+$/, '').split('\n')
  if (lines.length < 3) return null
  const code = Number.parseInt(lines[0], 16)
  if (Number.isNaN(code)) return null
  if (code === 0) {
    const pid = Number.parseInt(lines[1], 16)
    return Number.isInteger(pid) && pid > 0 ? { pid } : null
  }
  return { error: `${lines.slice(2).join(' ').trim() || lines[1]} (0x${code.toString(16)})` }
}

export class OpenvpnServiceBroker implements PrivilegeBroker {
  constructor(
    private readonly workdir: string,
    private readonly pipe: string = OPENVPN_SERVICE_PIPE,
    private readonly open: (path: string) => Socket = (path) => connect(path)
  ) {}

  /** `binary` is ignored: the service always runs its own openvpn.exe. */
  launch(_binary: string, args: string[]): LaunchedProcess {
    const exited = new Promise<LaunchResult>((resolve) => {
      let started = false
      let text = ''
      const socket = this.open(this.pipe)
      socket.once('connect', () => socket.write(buildStartupMessage(this.workdir, args)))
      socket.on('data', (chunk: Buffer) => {
        text += chunk.toString('utf16le')
        const reply = parseServiceReply(text)
        if (!reply) return
        text = ''
        if ('error' in reply) {
          resolve({
            code: 1,
            error: new VpnError('DRIVER_CRASHED', `Serviço do OpenVPN: ${reply.error}`)
          })
          socket.destroy()
          return
        }
        started = true
      })
      socket.once('error', (error: NodeJS.ErrnoException) => {
        if (started) return resolve({ code: null })
        const missing = error.code === 'ENOENT'
        resolve({
          code: null,
          error: new VpnError(
            missing ? 'BINARY_MISSING' : 'DRIVER_CRASHED',
            missing
              ? 'O serviço do OpenVPN não está instalado ou parado. Instale o componente de VPN do North.'
              : `Serviço do OpenVPN: ${error.message}`
          )
        })
      })
      // the service closes the pipe when openvpn.exe exits
      socket.once('close', () => resolve({ code: started ? 0 : 1 }))
    })
    return { exited }
  }

  /** openvpn.exe runs as this user, so North may stop it itself. */
  async kill(pid: number): Promise<void> {
    if (!Number.isInteger(pid) || pid <= 1) return
    try {
      process.kill(pid)
    } catch {
      // already gone
    }
  }
}
