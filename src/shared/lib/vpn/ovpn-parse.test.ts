import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OvpnParseError, parseOvpn } from './ovpn-parse'

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../../../../test/fixtures/ovpn', name), 'utf8')

describe('parseOvpn', () => {
  it('detects user/pass, encrypted key, remotes and routes; extracts secret blocks', () => {
    const parsed = parseOvpn(fixture('inline-userpass-encrypted-key.ovpn'))

    expect(parsed.config).toMatchObject({
      kind: 'openvpn',
      requiresUserPass: true,
      requiresKeyPassphrase: true,
      redirectGateway: false,
      remoteSummary: [
        { host: 'vpn.acme.com', port: 1194, proto: 'udp' },
        { host: 'vpn2.acme.com', port: 443, proto: 'tcp' }
      ],
      declaredRoutes: ['10.20.0.0/16', '192.168.50.0/24']
    })
    expect(Object.keys(parsed.inlineBlocks).sort()).toEqual(['key', 'tls-crypt'])
    expect(parsed.inlineBlocks.key).toContain('ENCRYPTED PRIVATE KEY')
    expect(parsed.suggestedName).toBe('vpn.acme.com')

    // secret material never stays in the stored config
    expect(parsed.config.ovpn).not.toContain('MIIFAKEENCRYPTEDKEY')
    expect(parsed.config.ovpn).not.toContain('deadbeef')
    expect(parsed.config.ovpn).not.toMatch(/<key>|<tls-crypt>/)
    // public material stays
    expect(parsed.config.ovpn).toContain('<ca>')
    expect(parsed.config.ovpn).toContain('<cert>')
  })

  it('plain key without auth-user-pass, full tunnel', () => {
    const parsed = parseOvpn(fixture('plain-cert-only.ovpn'))
    expect(parsed.config.requiresUserPass).toBe(false)
    expect(parsed.config.requiresKeyPassphrase).toBe(false)
    expect(parsed.config.redirectGateway).toBe(true)
    expect(parsed.config.remoteSummary).toEqual([
      { host: '203.0.113.10', port: 1194, proto: 'udp' }
    ])
  })

  it('legacy PEM with Proc-Type ENCRYPTED and proto tcp-client, default port', () => {
    const parsed = parseOvpn(fixture('legacy-rsa-encrypted.ovpn'))
    expect(parsed.config.requiresKeyPassphrase).toBe(true)
    expect(parsed.config.remoteSummary).toEqual([
      { host: 'legacy.example.org', port: 1194, proto: 'tcp' }
    ])
  })

  it('rejects script hooks with an explanatory error', () => {
    expect(() => parseOvpn(fixture('dangerous.ovpn'))).toThrow(OvpnParseError)
    try {
      parseOvpn(fixture('dangerous.ovpn'))
    } catch (error) {
      expect((error as OvpnParseError).directive).toBe('script-security')
    }
  })

  it.each([
    'up /x.sh',
    'down /x.sh',
    'route-up /x.sh',
    'plugin /lib/x.so',
    'management 0.0.0.0 7505',
    'config other.conf',
    'log /etc/passwd',
    'writepid /tmp/x',
    'tls-verify /x.sh',
    'auth-user-pass-verify /x.sh via-env',
    'key /home/me/client.key'
  ])('rejects "%s"', (line) => {
    expect(() => parseOvpn(`client\nremote a.example 1194\n${line}\n`)).toThrow(OvpnParseError)
  })

  it('allows script-security 1 and drops auth-user-pass file argument', () => {
    const parsed = parseOvpn(
      'client\nremote a.example\nscript-security 1\nauth-user-pass creds.txt\n'
    )
    expect(parsed.config.requiresUserPass).toBe(true)
    expect(parsed.config.ovpn).not.toContain('creds.txt')
    expect(parsed.config.ovpn).toMatch(/^auth-user-pass$/m)
  })

  it('requires at least one remote', () => {
    expect(() => parseOvpn('client\ndev tun\n')).toThrow(/remote/)
  })

  it('handles CRLF and comments', () => {
    const parsed = parseOvpn('client\r\n; comment\r\n# up /x\r\nremote b.example 1195 udp\r\n')
    expect(parsed.config.remoteSummary[0]).toEqual({ host: 'b.example', port: 1195, proto: 'udp' })
  })
})
