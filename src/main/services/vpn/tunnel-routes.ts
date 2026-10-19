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

/** Netmask "255.255.240.0" → 20, or null when it isn't contiguous. */
export function maskToPrefix(mask: string): number | null {
  const octets = mask.split('.').map(Number)
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255))
    return null
  const bits = octets.map((o) => o.toString(2).padStart(8, '0')).join('')
  return /^1*0*$/.test(bits) ? (bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')) : null
}

/** `route print -4` (Windows) "Active Routes": Destination Netmask Gateway Interface Metric. */
export function parseWindowsRoutes(output: string, localIp: string): string[] {
  const routes: string[] = []
  for (const line of output.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length !== 5 || cols[3] !== localIp || !/^\d+$/.test(cols[4])) continue
    const prefix = maskToPrefix(cols[1])
    if (prefix === null) continue
    const cidr = normalizeCidr(`${cols[0]}/${prefix}`)
    // the tunnel's own address and its subnet broadcast aren't networks it routes
    if (cidr && !IGNORED(cidr) && cidr !== `${localIp}/32`) routes.push(cidr)
  }
  return [...new Set(routes)]
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
  if (platform === 'win32') {
    return parseWindowsRoutes(
      await run('C:\\Windows\\System32\\route.exe', ['print', '-4']),
      localIp
    )
  }
  const iface = interfaceForIp(localIp)
  if (!iface) return []
  if (platform === 'darwin')
    return parseNetstatRoutes(await run('/usr/sbin/netstat', ['-rn', '-f', 'inet']), iface)
  if (platform === 'linux')
    return parseIpRoutes(await run('/sbin/ip', ['-4', 'route', 'show', 'dev', iface]))
  return []
}
