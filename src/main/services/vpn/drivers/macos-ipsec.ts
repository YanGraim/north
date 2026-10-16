import { createHash } from 'node:crypto'

/** Pure helpers for the macOS built-in "Cisco IPSec" client (IKEv1 PSK + XAuth) via scutil. */

export type NcService = {
  enabled: boolean
  status: string
  id: string
  name: string
  type: string
}

const NC_LINE = /^(\*)?\s*\(([^)]+)\)\s+([0-9A-Fa-f-]{36})\s+.*?"(.*)"\s+\[([^\]]+)\]\s*$/

export function parseNcList(stdout: string): NcService[] {
  const services: NcService[] = []
  for (const line of stdout.split('\n')) {
    const m = NC_LINE.exec(line)
    if (m) services.push({ enabled: m[1] === '*', status: m[2], id: m[3], name: m[4], type: m[5] })
  }
  return services
}

export type NcStatus = { status: string; localIp?: string; lastCause?: number }

export function parseNcStatus(stdout: string): NcStatus {
  const [first = ''] = stdout.split('\n')
  const result: NcStatus = { status: first.trim() }
  const ipv4 = /IPv4 : <dictionary> \{[\s\S]*?Addresses : <array> \{\s*0 : ([0-9.]+)/.exec(stdout)
  if (ipv4) result.localIp = ipv4[1]
  const cause = /LastCause : (\d+)/.exec(stdout)
  if (cause) result.lastCause = Number(cause[1])
  return result
}

/** Service name shown in macOS network settings — the driver finds its service by it. */
export function northServiceName(profileName: string): string {
  return `North · ${profileName}`
}

function stableUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase()
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type IpsecProfileInput = {
  profileId: string
  name: string
  gateway: string
  groupName?: string
  username: string
  psk: string
  /** Omitted → macOS asks for the XAuth password on connect. */
  xauthPassword?: string
}

/**
 * `.mobileconfig` with one `com.apple.vpn.managed` payload. macOS moves the PSK and
 * XAuth password into the Keychain on install, so `scutil --nc start` never needs
 * secrets in argv. Identifiers derive from the profile id: reinstalling replaces it.
 */
export function buildIpsecMobileconfig(input: IpsecProfileInput): string {
  const identifier = `app.north.vpn.${input.profileId}`
  const groupKeys = input.groupName
    ? `
\t\t\t\t<key>LocalIdentifier</key>
\t\t\t\t<string>${esc(input.groupName)}</string>
\t\t\t\t<key>LocalIdentifierType</key>
\t\t\t\t<string>KeyID</string>`
    : ''
  const xauthPassword =
    input.xauthPassword !== undefined
      ? `
\t\t\t\t<key>XAuthPassword</key>
\t\t\t\t<string>${esc(input.xauthPassword)}</string>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>PayloadContent</key>
\t<array>
\t\t<dict>
\t\t\t<key>PayloadType</key>
\t\t\t<string>com.apple.vpn.managed</string>
\t\t\t<key>PayloadVersion</key>
\t\t\t<integer>1</integer>
\t\t\t<key>PayloadIdentifier</key>
\t\t\t<string>${identifier}.ipsec</string>
\t\t\t<key>PayloadUUID</key>
\t\t\t<string>${stableUuid(`${identifier}.ipsec`)}</string>
\t\t\t<key>PayloadDisplayName</key>
\t\t\t<string>${esc(northServiceName(input.name))}</string>
\t\t\t<key>UserDefinedName</key>
\t\t\t<string>${esc(northServiceName(input.name))}</string>
\t\t\t<key>VPNType</key>
\t\t\t<string>IPSec</string>
\t\t\t<key>IPSec</key>
\t\t\t<dict>
\t\t\t\t<key>RemoteAddress</key>
\t\t\t\t<string>${esc(input.gateway)}</string>
\t\t\t\t<key>AuthenticationMethod</key>
\t\t\t\t<string>SharedSecret</string>
\t\t\t\t<key>SharedSecret</key>
\t\t\t\t<data>${Buffer.from(input.psk, 'utf8').toString('base64')}</data>${groupKeys}
\t\t\t\t<key>XAuthEnabled</key>
\t\t\t\t<integer>1</integer>
\t\t\t\t<key>XAuthName</key>
\t\t\t\t<string>${esc(input.username)}</string>${xauthPassword}
\t\t\t\t<key>PromptForVPNPIN</key>
\t\t\t\t<false/>
\t\t\t</dict>
\t\t</dict>
\t</array>
\t<key>PayloadDisplayName</key>
\t<string>${esc(northServiceName(input.name))}</string>
\t<key>PayloadIdentifier</key>
\t<string>${identifier}</string>
\t<key>PayloadUUID</key>
\t<string>${stableUuid(identifier)}</string>
\t<key>PayloadType</key>
\t<string>Configuration</string>
\t<key>PayloadVersion</key>
\t<integer>1</integer>
\t<key>PayloadScope</key>
\t<string>User</string>
</dict>
</plist>
`
}
