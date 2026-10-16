import type { VpnConfig } from '@shared/types'

/**
 * FortiClient shows "host:port" in a single gateway field; users paste it as is.
 * Accepts `host`, `host:port`, `[v6]:port` and stray `https://…/`.
 */
export function splitHostPort(input: string): { host: string; port?: number } {
  const value = input
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/\/.*$/, '')
  const bracketed = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(value)
  if (bracketed) {
    const port = bracketed[2] ? Number(bracketed[2]) : undefined
    return port && port <= 65535 ? { host: bracketed[1], port } : { host: bracketed[1] }
  }
  const match = /^([^:]+):(\d{1,5})$/.exec(value)
  if (match) {
    const port = Number(match[2])
    if (port >= 1 && port <= 65535) return { host: match[1], port }
  }
  return { host: value }
}

/** Main and renderer both apply this before saving a FortiGate SSL-VPN. */
export function normalizeFortinetConfig<T extends VpnConfig>(config: T): T {
  if (config.kind !== 'fortinet-sslvpn') return config
  const { host, port } = splitHostPort(config.gateway)
  return { ...config, gateway: host, port: port ?? config.port }
}
