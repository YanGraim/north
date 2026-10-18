import { execFile } from 'node:child_process'
import { networkInterfaces } from 'node:os'

/**
 * Routes a tunnel actually installed, read from the OS routing table — for drivers whose
 * client doesn't log them (openfortivpn/pppd). Only what goes through the tunnel's
 * interface, minus defaults scoped to it, multicast, broadcast and link-local.
 */

/** "172.16.40/24" → "172.16.40.0/24" (netstat on macOS drops trailing zero octets). */
export function normalizeCidr(dest: string): string | null {
  const [addr, bits] = dest.split('/')
  if (!bits) return null
  const octets = addr.split('.')
  if (octets.length > 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return null
  while (octets.length < 4) octets.push('0')
  return `${octets.join('.')}/${bits}`
}

const IGNORED = (cidr: string) =>
  /^(0\.0\.0\.0\/0|22[4-9]\.|23\d\.|255\.255\.255\.255|169\.254\.)/.test(cidr)

/** `netstat -rn -f inet` (macOS): Destination Gateway Flags Netif … */
export function parseNetstatRoutes(output: string, iface: string): string[] {
  const routes: string[] = []
  for (const line of output.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4 || cols[3] !== iface) continue
    const cidr = normalizeCidr(cols[0])
    if (cidr && !IGNORED(cidr)) routes.push(cidr)
  }
  return [...new Set(routes)]
}

/** `ip -4 route show dev <iface>` (Linux): "172.16.40.0/24 proto kernel scope link …" */
export function parseIpRoutes(output: string): string[] {
  const routes: string[] = []
  for (const line of output.split('\n')) {
    const dest = line.trim().split(/\s+/)[0]
    if (!dest || dest === 'default') continue
    const cidr = dest.includes('/') ? normalizeCidr(dest) : null
    if (cidr && !IGNORED(cidr)) routes.push(cidr)
  }
  return [...new Set(routes)]
}

export function interfaceForIp(ip: string): string | null {
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (addrs?.some((a) => a.family === 'IPv4' && a.address === ip)) return name
  }
  return null
}

const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (_error, stdout) => resolve(String(stdout ?? '')))
  })

/** Best effort: [] when the interface or the table can't be read. */
export async function listTunnelRoutes(
  localIp: string,
  platform: NodeJS.Platform = process.platform
): Promise<string[]> {
  const iface = interfaceForIp(localIp)
  if (!iface) return []
  if (platform === 'darwin')
    return parseNetstatRoutes(await run('/usr/sbin/netstat', ['-rn', '-f', 'inet']), iface)
  if (platform === 'linux')
    return parseIpRoutes(await run('/sbin/ip', ['-4', 'route', 'show', 'dev', iface]))
  return []
}
