/**
 * What `north-vpn-helper openvpn` accepts (mirrors its awk whitelist — a test keeps them
 * in sync). Configs outside it still connect, through the per-connection admin prompt.
 */
export const HELPER_OVPN_DIRECTIVES = [
  'client',
  'dev',
  'dev-type',
  'proto',
  'remote',
  'remote-random',
  'remote-random-hostname',
  'resolv-retry',
  'nobind',
  'persist-key',
  'persist-tun',
  'remote-cert-tls',
  'ns-cert-type',
  'verify-x509-name',
  'cipher',
  'ciphers',
  'data-ciphers',
  'data-ciphers-fallback',
  'ncp-ciphers',
  'ncp-disable',
  'auth',
  'comp-lzo',
  'compress',
  'allow-compression',
  'verb',
  'mute',
  'mute-replay-warnings',
  'key-direction',
  'key-method',
  'tls-client',
  'tls-version-min',
  'tls-version-max',
  'tls-cipher',
  'tls-ciphersuites',
  'tls-groups',
  'tls-timeout',
  'tls-exit',
  'reneg-sec',
  'reneg-bytes',
  'hand-window',
  'tran-window',
  'replay-window',
  'keepalive',
  'ping',
  'ping-restart',
  'ping-exit',
  'inactive',
  'float',
  'route',
  'route-ipv6',
  'route-nopull',
  'route-delay',
  'route-metric',
  'redirect-gateway',
  'pull',
  'pull-filter',
  'dhcp-option',
  'block-outside-dns',
  'tun-mtu',
  'tun-mtu-extra',
  'link-mtu',
  'mssfix',
  'fragment',
  'mtu-disc',
  'txqueuelen',
  'sndbuf',
  'rcvbuf',
  'fast-io',
  'passtos',
  'explicit-exit-notify',
  'server-poll-timeout',
  'connect-retry',
  'connect-retry-max',
  'connect-timeout',
  'topology',
  'port',
  'lport',
  'rport',
  'bind',
  'push-peer-info',
  'auth-nocache',
  'auth-token',
  'auth-token-user',
  'static-challenge',
  'setenv',
  'ignore-unknown-option',
  'ifconfig-nowarn',
  'tun-ipv6',
  'opt-verify',
  'machine-readable-output',
  'x509-track',
  'auth-user-pass'
] as const

export const HELPER_OVPN_BLOCKS = [
  'ca',
  'cert',
  'key',
  'tls-auth',
  'tls-crypt',
  'tls-crypt-v2',
  'pkcs12',
  'extra-certs',
  'peer-fingerprint',
  'secret'
] as const

/** null = the helper will run it; otherwise the first reason it would refuse. */
export function helperRefusal(ovpn: string): string | null {
  let block: string | null = null
  for (const raw of ovpn.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (block) {
      if (line === `</${block}>`) block = null
      continue
    }
    if (/^[ \t]*([#;]|$)/.test(line)) continue
    const tag = /^<([a-z0-9-]+)>$/.exec(line)
    if (tag) {
      if (!(HELPER_OVPN_BLOCKS as readonly string[]).includes(tag[1])) return `bloco <${tag[1]}>`
      block = tag[1]
      continue
    }
    const words = line.trim().split(/\s+/)
    if (words[0] === 'auth-user-pass' && words.length > 1) return 'auth-user-pass com arquivo'
    if (!(HELPER_OVPN_DIRECTIVES as readonly string[]).includes(words[0])) return words[0]
  }
  return null
}
