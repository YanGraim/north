import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIpsecMobileconfig, parseNcList, parseNcStatus } from './macos-ipsec'

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../../../../../test/fixtures/scutil', name), 'utf8')

describe('parseNcList', () => {
  it('parses the real output of this machine (PPP and FortiClient extension)', () => {
    expect(parseNcList(fixture('nc-list.txt'))).toEqual([
      {
        enabled: true,
        status: 'Disconnected',
        id: 'F8FBD758-FFDD-45FC-80A4-F1B35BC6F8BB',
        name: 'ECOFITUS',
        type: 'PPP:L2TP'
      },
      {
        enabled: true,
        status: 'Disconnected',
        id: 'E11DB223-0CD3-4D27-9069-B145849FC6A3',
        name: 'VPN',
        type: 'VPN:com.fortinet.forticlient.macos.vpn'
      }
    ])
  })

  it('finds a North IPSec service, including disabled ones', () => {
    const list = parseNcList(fixture('nc-list-with-north.txt'))
    expect(list.find((s) => s.name === 'North · POLY')).toEqual({
      enabled: true,
      status: 'Connected',
      id: '0F6A5C3E-1111-4222-8333-944455556666',
      name: 'North · POLY',
      type: 'IPSec'
    })
    expect(list.at(-1)?.enabled).toBe(false)
  })
})

describe('parseNcStatus', () => {
  it('connected with IPv4 address', () => {
    expect(parseNcStatus(fixture('nc-status-connected.txt'))).toEqual({
      status: 'Connected',
      localIp: '10.212.134.5'
    })
  })
  it('disconnected with LastCause', () => {
    expect(parseNcStatus(fixture('nc-status-failed.txt'))).toEqual({
      status: 'Disconnected',
      lastCause: 14
    })
  })
  it('connecting', () => {
    expect(parseNcStatus(fixture('nc-status-connecting.txt'))).toEqual({ status: 'Connecting' })
  })
})

describe('buildIpsecMobileconfig', () => {
  const input = {
    profileId: '11111111-1111-4111-8111-111111111111',
    name: 'POLY <&"x">',
    gateway: 'poly.fortiddns.com',
    groupName: 'grupo',
    username: 'yan',
    psk: 'psk&<secret>',
    xauthPassword: 'pw"1'
  }

  it('builds a Cisco IPSec (IKEv1 PSK + XAuth) payload with escaped values', () => {
    const xml = buildIpsecMobileconfig(input)
    expect(xml).toContain('<string>com.apple.vpn.managed</string>')
    expect(xml).toContain('<key>VPNType</key>\n\t\t\t<string>IPSec</string>')
    expect(xml).toContain('<string>SharedSecret</string>')
    expect(xml).toContain('<string>poly.fortiddns.com</string>')
    expect(xml).toContain('<string>KeyID</string>')
    expect(xml).toContain('<string>grupo</string>')
    expect(xml).toContain(`<data>${Buffer.from('psk&<secret>').toString('base64')}</data>`)
    expect(xml).toContain('<string>pw&quot;1</string>')
    expect(xml).toContain('<string>North · POLY &lt;&amp;&quot;x&quot;&gt;</string>')
    expect(xml).not.toContain('psk&<secret>')
  })

  it('identifiers are stable per profile, so reinstalling replaces instead of duplicating', () => {
    const a = buildIpsecMobileconfig(input)
    const b = buildIpsecMobileconfig({ ...input, psk: 'other' })
    const uuids = (xml: string) =>
      [...xml.matchAll(/<key>PayloadUUID<\/key>\s*<string>([^<]+)</g)].map((m) => m[1])
    expect(uuids(a)).toEqual(uuids(b))
    expect(uuids(a)).toHaveLength(2)
    expect(a).toContain('<string>app.north.vpn.11111111-1111-4111-8111-111111111111</string>')
  })

  it('omits XAuthPassword when the user chose "ask on connect"', () => {
    const xml = buildIpsecMobileconfig({ ...input, xauthPassword: undefined })
    expect(xml).not.toContain('XAuthPassword')
    expect(xml).toContain('<key>XAuthName</key>')
  })

  it.runIf(process.platform === 'darwin')('is a valid plist (plutil -lint)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'north-plist-'))
    try {
      const file = join(dir, 'p.mobileconfig')
      writeFileSync(file, buildIpsecMobileconfig(input))
      expect(execFileSync('plutil', ['-lint', file]).toString()).toContain('OK')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
