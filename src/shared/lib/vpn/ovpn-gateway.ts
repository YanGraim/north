import type { VpnConfig, VpnRemote } from '../../types'

type OpenVpnConfig = Extract<VpnConfig, { kind: 'openvpn' }>

const remoteKey = (r: VpnRemote) => `${r.host.trim().toLowerCase()}:${r.port}`

/**
 * What an organization keeps of an OpenVPN (REC-023): only where it connects.
 * A .ovpn usually embeds the person's own certificate and key, so the shared
 * part is rebuilt from the remotes alone; each person imports their own file.
 */
export function openvpnGatewayOnly(config: OpenVpnConfig): OpenVpnConfig {
  const remotes = config.remoteSummary.map((r) => ({
    host: r.host.trim(),
    port: r.port,
    proto: r.proto
  }))
  return {
    kind: 'openvpn',
    ovpn: ['client', ...remotes.map((r) => `remote ${r.host} ${r.port} ${r.proto}`)].join('\n'),
    requiresUserPass: config.requiresUserPass,
    requiresKeyPassphrase: false,
    username: '',
    remoteSummary: remotes,
    redirectGateway: config.redirectGateway,
    declaredRoutes: config.declaredRoutes
  }
}

/** Two OpenVPN configs reach the same server when they share a remote. */
export function sameOpenvpnGateway(a: OpenVpnConfig, b: OpenVpnConfig): boolean {
  const mine = new Set(a.remoteSummary.map(remoteKey))
  return b.remoteSummary.some((r) => mine.has(remoteKey(r)))
}
