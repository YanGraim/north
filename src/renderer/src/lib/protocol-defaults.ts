import type { ConnectionProtocol } from '@shared/types'

const DEFAULT_PORTS: Record<ConnectionProtocol, number> = {
  ssh: 22,
  rdp: 3389,
  vnc: 5900,
  sftp: 22,
  ftp: 21,
  telnet: 23,
  serial: 115200,
  http: 80,
  https: 443,
  custom: 22
}

export function defaultPortForProtocol(protocol: ConnectionProtocol): number {
  return DEFAULT_PORTS[protocol] ?? 22
}
