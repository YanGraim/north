import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VpnProfile } from '@shared/types'
import { afterEach, describe, expect, it } from 'vitest'
import type { VpnError } from '../vpn-error'
import type { HelperRun } from '../vpn-helper'
import { WindowsVpnService } from '../windows-vpn-service'
import { certFingerprints, OpenconnectDriver, parseOpenconnectLine } from './openconnect-driver'

const PIN = 'a'.repeat(64)
const SPKI = 'c'.repeat(64)

const profile = (trustedCert?: string) =>
  ({
    id: 'p1',
    name: 'PAC',
    config: {
      kind: 'fortinet-sslvpn',
      gateway: 'vpn.example.com',
      port: 4433,
      username: 'ana',
      trustedCert
    }
  }) as unknown as VpnProfile

const ctx = (trustedCert?: string, lines: string[] = []) => ({
  profile: profile(trustedCert),
  secrets: { get: () => 'pw', inlineBlocks: () => ({}), values: () => ['pw'] },
  log: (l: string) => lines.push(l),
  signal: new AbortController().signal
})

/** fake service: replays engine lines, then keeps running until stopped */
function fakeService(script: string[], exitCode = 0) {
  const requests: unknown[] = []
  let stopped = false
  const service = {
    ensure: async () => {},
    startForti: (req: unknown, onOutput: (l: string) => void): HelperRun => {
      requests.push(req)
      let finish: (r: { code: number | null }) => void = () => {}
      const exited = new Promise<{ code: number | null }>((r) => {
        finish = r
      })
      setTimeout(() => {
        for (const l of script) onOutput(l)
        if (!script.some((l) => l.startsWith('Connected as'))) finish({ code: exitCode })
      }, 5)
      return {
        exited,
        stop: () => {
          stopped = true
          finish({ code: 0 })
        }
      }
    }
  }
  return { service, requests, stopped: () => stopped }
}

const cert =
  (digest: string, trustedBySystem = false) =>
  async () => ({ digest, spki: SPKI, trustedBySystem })

// self-signed, with the EC curve written out in full: re-encoding the key would change its hash
const CERT_PEM = `-----BEGIN CERTIFICATE-----
MIICFjCCAb4CCQC7mMVlVHxq5zAKBggqhkjOPQQDAjAaMRgwFgYDVQQDDA92cG4u
ZXhhbXBsZS5jb20wHhcNMjYxMDE5MTkyMzA1WhcNMzYxMDE2MTkyMzA1WjAaMRgw
FgYDVQQDDA92cG4uZXhhbXBsZS5jb20wggFLMIIBAwYHKoZIzj0CATCB9wIBATAs
BgcqhkjOPQEBAiEA/////wAAAAEAAAAAAAAAAAAAAAD///////////////8wWwQg
/////wAAAAEAAAAAAAAAAAAAAAD///////////////wEIFrGNdiqOpPns+u9VXaY
hrxlHQawzFOw9jvOPD4n0mBLAxUAxJ02CIbnBJNqZnjhE50mt4GffpAEQQRrF9Hy
4SxCR/i85uVjpEDydwN9gS3rM6D0oTlF2JjClk/jQuL+Gn+bjufrSnwPnhYrzjNX
azFezsu2QGg3v1H1AiEA/////wAAAAD//////////7zm+q2nF56E87nKwvxjJVEC
AQEDQgAEl+f5fqnQW4x/fJlmladXPEolU5G8qgTeps3hswipzkam+HMgfwi1KPlk
P9MbtyKcpVFiQka9Fjl4T6mfmBYy0TAKBggqhkjOPQQDAgNGADBDAh80mb6uE/01
7ICGkqOiYAYvg97N0Ewco+O5YkgIReIOAiA3hgPCyeBepicWrXipVRbhWx2a4B4B
ouhCEGkMjEU8/g==
-----END CERTIFICATE-----`

describe('certFingerprints', () => {
  it('certificate sha256 for the user, public-key sha256 for openconnect (as openssl computes them)', () => {
    const der = Buffer.from(CERT_PEM.replace(/-----[A-Z ]+-----|\s/g, ''), 'base64')
    expect(certFingerprints(der)).toEqual({
      // openssl x509 -outform der | sha256
      digest: '86aa71c9e84fddd364d238ecf2fcf84bffb1fe0fb9f33487e0a54f30858a1928',
      // openssl x509 -pubkey | openssl pkey -pubin -outform der | sha256
      spki: '2f6b0948f8efa545578e02045ed30fe5d022ca70d8025e44b4a96044826ab01f'
    })
  })
})

describe('parseOpenconnectLine', () => {
  it('recognizes up, auth, certificate and reachability lines', () => {
    expect(
      parseOpenconnectLine('Connected as 10.212.134.200, using SSL, with DTLS disabled')
    ).toEqual({
      type: 'up',
      ip: '10.212.134.200'
    })
    expect(parseOpenconnectLine('Configured as 10.0.0.9, with SSL connected')).toMatchObject({
      type: 'up'
    })
    expect(parseOpenconnectLine('Login failed.').type).toBe('auth-failed')
    // printed before openconnect checks the pin: not a rejection by itself
    expect(parseOpenconnectLine('Server certificate verify failed: signer not found').type).toBe(
      'other'
    )
    expect(
      parseOpenconnectLine(
        "None of the 1 fingerprint(s) specified via --servercert match server's certificate: pin-sha256:Tmf="
      ).type
    ).toBe('cert-rejected')
    expect(parseOpenconnectLine('Failed to connect to host vpn.example.com').type).toBe(
      'unreachable'
    )
  })
})

describe('OpenconnectDriver (Windows SSL-VPN)', () => {
  it('connects with the pinned certificate and reports the tunnel routes', async () => {
    const fake = fakeService([
      'POST https://vpn.example.com:4433/remote/logincheck',
      'Connected as 10.10.100.50, using SSL'
    ])
    const driver = new OpenconnectDriver({
      service: fake.service,
      gatewayCert: cert(PIN),
      routes: async () => ['172.16.40.0/24']
    })
    const info = await driver.connect(ctx(PIN))
    expect(info).toEqual({
      localIp: '10.10.100.50',
      routes: ['172.16.40.0/24'],
      redirectGateway: false
    })
    expect(fake.requests[0]).toEqual({
      host: 'vpn.example.com',
      port: 4433,
      user: 'ana',
      password: 'pw',
      realm: undefined,
      cert: SPKI // openconnect pins the public key, not the DER the user trusted
    })
    await driver.disconnect()
    expect(fake.stopped()).toBe(true)
  })

  it('first connection to a self-signed gateway: asks to trust it before any tunnel starts', async () => {
    const fake = fakeService([])
    const driver = new OpenconnectDriver({ service: fake.service, gatewayCert: cert(PIN) })
    const error = (await driver.connect(ctx()).catch((e) => e)) as VpnError
    expect(error.code).toBe('CERT_UNTRUSTED')
    expect(error.certDigest).toBe(PIN)
    expect(fake.requests).toHaveLength(0)
  })

  it('certificate changed since it was trusted → blocks', async () => {
    const fake = fakeService([])
    const driver = new OpenconnectDriver({
      service: fake.service,
      gatewayCert: cert('b'.repeat(64))
    })
    const error = (await driver.connect(ctx(PIN)).catch((e) => e)) as VpnError
    expect(error.message).toMatch(/MUDOU/)
    expect(fake.requests).toHaveLength(0)
  })

  it('wrong password → AUTH_FAILED', async () => {
    const fake = fakeService(['Login failed.'], 1)
    const driver = new OpenconnectDriver({ service: fake.service, gatewayCert: cert(PIN) })
    const error = (await driver.connect(ctx(PIN)).catch((e) => e)) as VpnError
    expect(error.code).toBe('AUTH_FAILED')
  })

  it('tunnel drops later → onDrop', async () => {
    let finish: (r: { code: number }) => void = () => {}
    const service = {
      ensure: async () => {},
      startForti: (_req: unknown, onOutput: (l: string) => void): HelperRun => {
        setTimeout(() => onOutput('Connected as 10.0.0.2, using SSL'), 5)
        return {
          exited: new Promise((r) => {
            finish = r
          }),
          stop: () => finish({ code: 0 })
        }
      }
    }
    const driver = new OpenconnectDriver({ service, gatewayCert: cert(PIN) })
    await driver.connect(ctx(PIN))
    const dropped = new Promise<Error | undefined>((r) => driver.onDrop(r))
    finish({ code: 1 })
    expect((await dropped)?.message).toMatch(/caiu/)
  })
})

describe.runIf(process.platform !== 'win32')('WindowsVpnService pipe client', () => {
  let dir: string
  let server: Server
  afterEach(() => {
    server?.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('sends one JSON request the Go service accepts and streams the log until NORTH-EXIT', async () => {
    dir = mkdtempSync(join(tmpdir(), 'north-svc-'))
    const pipe = join(dir, 'pipe')
    let received = ''
    server = createServer((socket) => {
      socket.once('data', (chunk) => {
        received = chunk.toString()
        socket.write('Connected as 10.0.0.5, using SSL\r\n')
        socket.on('end', () => socket.end('NORTH-EXIT 0\n'))
      })
    })
    await new Promise<void>((r) => server.listen(pipe, r))
    const service = new WindowsVpnService({
      bundled: () => null,
      programFiles: 'C:\\Program Files',
      userSid: async () => 'S-1-5-21-1-2-3-1001',
      digest: () => null,
      elevate: async () => {},
      pipe
    })
    const lines: string[] = []
    const run = service.startForti(
      { host: 'vpn.example.com', port: 443, user: 'ana', password: 'pw', cert: PIN },
      (l) => lines.push(l)
    )
    await new Promise((r) => setTimeout(r, 50))
    // exactly the Go struct's fields (it rejects unknown ones)
    expect(Object.keys(JSON.parse(received)).sort()).toEqual(
      ['cert', 'cmd', 'host', 'password', 'port', 'realm', 'user'].sort()
    )
    expect(lines).toEqual(['Connected as 10.0.0.5, using SSL'])
    run.stop()
    expect(await run.exited).toEqual({ code: 0 })
  })
})
