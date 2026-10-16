/** Pure parser for openfortivpn's stdout (it has no management interface). */
export type FortiEvent =
  | { type: 'up' }
  | { type: 'address'; ip: string }
  | { type: 'auth-failed' }
  | { type: 'cert-untrusted' }
  | { type: 'cert-digest'; digest: string }
  | { type: 'error'; message: string }
  | { type: 'other'; line: string }

export function parseFortiLine(raw: string): FortiEvent {
  const line = raw.trim()
  if (/Tunnel is up and running/.test(line)) return { type: 'up' }
  const addr = /Got addresses: \[([0-9.]+)\]/.exec(line)
  if (addr) return { type: 'address', ip: addr[1] }
  if (/Could not authenticate to( the)? gateway|VPN authentication failed/i.test(line)) {
    return { type: 'auth-failed' }
  }
  if (/certificate validation failed/i.test(line)) return { type: 'cert-untrusted' }
  const digest = /--trusted-cert\s+([0-9a-f]{64})/.exec(line)
  if (digest) return { type: 'cert-digest', digest: digest[1] }
  const error = /^ERROR:\s+(.*)$/.exec(line)
  if (error) return { type: 'error', message: error[1] }
  return { type: 'other', line }
}

/** openfortivpn reads a config file; values must not smuggle extra lines/options. */
export function buildFortiConfig(input: {
  gateway: string
  port: number
  username: string
  password: string
  realm?: string
  trustedCert?: string
}): string {
  const values = [
    input.gateway,
    input.username,
    input.password,
    input.realm ?? '',
    input.trustedCert ?? ''
  ]
  if (values.some((v) => /[\r\n]/.test(v))) {
    throw new Error('Configuration values must not contain line breaks')
  }
  return [
    `host = ${input.gateway}`,
    `port = ${input.port}`,
    `username = ${input.username}`,
    `password = ${input.password}`,
    ...(input.realm ? [`realm = ${input.realm}`] : []),
    ...(input.trustedCert ? [`trusted-cert = ${input.trustedCert}`] : []),
    ''
  ].join('\n')
}
