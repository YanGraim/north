import { createHash } from 'node:crypto'

export function fingerprintHostKey(hostKey: Buffer | Uint8Array): string {
  const digest = createHash('sha256').update(hostKey).digest('base64')
  return `SHA256:${digest.replace(/=+$/, '')}`
}

export function parseHostKeyType(key: Uint8Array | Buffer): string {
  const view = Buffer.isBuffer(key) ? key : Buffer.from(key)
  if (view.length < 4) return 'unknown'
  const len = view.readUInt32BE(0)
  if (len <= 0 || len > 64 || view.length < 4 + len) return 'unknown'
  return view.subarray(4, 4 + len).toString('ascii')
}

export function parseSshConnectionConfig(opts: {
  host: string
  port: number
  username: string | null
}): { host: string; port: number; username: string } {
  const host = opts.host.trim()
  if (!host) {
    throw new Error('SSH host is required')
  }
  const port = opts.port
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SSH port is invalid')
  }
  const username = opts.username?.trim() || process.env.USER || 'root'
  return { host, port, username }
}

/** Map ssh2 client errors to stable Portuguese messages for the UI. */
export function formatSshClientError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error)
  const level =
    error && typeof error === 'object' && 'level' in error
      ? String((error as { level?: unknown }).level)
      : ''

  if (
    level === 'client-authentication' ||
    /all configured authentication methods failed/i.test(raw)
  ) {
    return new Error(
      'Autenticação SSH recusada. Confira usuário/senha no vault, método de auth e se a VPN está conectada.'
    )
  }

  if (/timed out|timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(raw)) {
    return new Error(`Não foi possível alcançar o host (${raw}). Verifique IP, porta e VPN.`)
  }

  return error instanceof Error ? error : new Error(raw)
}
