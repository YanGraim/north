import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type FakeOidcProvider, startFakeOidc } from '../../../server/src/dev/fake-oidc'
import { entraError, type OidcInfo, SignInCancelledError, signInWithBrowser } from './oidc-sign-in'

let idp: FakeOidcProvider
let info: OidcInfo
beforeAll(async () => {
  idp = await startFakeOidc()
  const base = idp.issuer.replace('/v2.0', '')
  info = {
    clientId: idp.clientId,
    scopes: ['openid', 'profile', 'email'],
    authorizationEndpoint: `${base}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${base}/oauth2/v2.0/token`
  }
})
afterAll(() => idp.close())

/** Plays the system browser: opens the page and follows the redirect to the loopback. */
async function browser(url: string): Promise<{ status: number; html: string }> {
  const page = await fetch(url, { redirect: 'manual' })
  const location = page.headers.get('location')
  if (!location) throw new Error(`no redirect (${page.status})`)
  const back = await fetch(location)
  return { status: back.status, html: await back.text() }
}

const decode = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())

describe('signInWithBrowser', () => {
  it('runs authorization code + PKCE and returns the id_token with its nonce', async () => {
    idp.signInAs({ email: 'ana@acme.com', name: 'Ana' })
    let landing: Promise<{ status: number; html: string }> | null = null
    const result = await signInWithBrowser(info, {
      openBrowser: (url) => {
        landing = browser(url)
      }
    })
    const claims = decode(result.idToken)
    expect(claims.preferred_username).toBe('ana@acme.com')
    expect(claims.nonce).toBe(result.nonce)
    expect(claims.aud).toBe(idp.clientId)
    const page = await (landing as unknown as Promise<{ status: number; html: string }>)
    expect(page.html).toContain('pode voltar ao North')
  })

  it('asks Microsoft for a loopback redirect with S256 PKCE and fresh state/nonce', async () => {
    const seen: URL[] = []
    for (let i = 0; i < 2; i++) {
      idp.signInAs({ email: 'ana@acme.com' })
      await signInWithBrowser(info, {
        openBrowser: (url) => {
          seen.push(new URL(url))
          void browser(url)
        }
      })
    }
    const [a, b] = seen.map((u) => u.searchParams)
    expect(a.get('redirect_uri')).toMatch(/^http:\/\/localhost:\d+$/)
    expect(a.get('code_challenge_method')).toBe('S256')
    expect(a.get('response_type')).toBe('code')
    expect(a.get('scope')).toBe('openid profile email')
    expect(a.get('client_secret')).toBeNull()
    expect(a.get('state')).not.toBe(b.get('state'))
    expect(a.get('nonce')).not.toBe(b.get('nonce'))
    expect(a.get('code_challenge')).not.toBe(b.get('code_challenge'))
  })

  it('ignores a redirect with the wrong state and keeps waiting', async () => {
    idp.signInAs({ email: 'ana@acme.com' })
    const result = await signInWithBrowser(info, {
      openBrowser: async (url) => {
        const redirect = new URL(url).searchParams.get('redirect_uri') as string
        const forged = await fetch(`${redirect}/?code=evil&state=forged`)
        expect(forged.status).toBe(400)
        void browser(url)
      }
    })
    expect(decode(result.idToken).preferred_username).toBe('ana@acme.com')
  })

  it('closes the loopback listener when done', async () => {
    idp.signInAs({ email: 'ana@acme.com' })
    let redirect = ''
    await signInWithBrowser(info, {
      openBrowser: (url) => {
        redirect = new URL(url).searchParams.get('redirect_uri') as string
        void browser(url)
      }
    })
    const port = new URL(redirect).port
    await expect(fetch(`http://127.0.0.1:${port}/?code=x&state=y`)).rejects.toThrow()
  })

  it('reports a refusal from Microsoft', async () => {
    await expect(
      signInWithBrowser(info, {
        openBrowser: async (url) => {
          const params = new URL(url).searchParams
          await fetch(
            `${params.get('redirect_uri')}/?error=access_denied&error_description=AADSTS65004&state=${params.get('state')}`
          )
        }
      })
    ).rejects.toThrow(/cancelado ou negado/)
  })

  it('can be cancelled while the browser is open', async () => {
    const controller = new AbortController()
    const pending = signInWithBrowser(info, {
      openBrowser: () => {
        setTimeout(() => controller.abort(), 10)
      },
      signal: controller.signal
    })
    await expect(pending).rejects.toBeInstanceOf(SignInCancelledError)
  })

  it('gives up after the timeout', async () => {
    await expect(
      signInWithBrowser(info, { openBrowser: () => undefined, timeoutMs: 30 })
    ).rejects.toThrow(/demorou demais/)
  })

  it('explains when the server could not reach Microsoft', async () => {
    await expect(
      signInWithBrowser({ ...info, authorizationEndpoint: null }, { openBrowser: () => undefined })
    ).rejects.toThrow(/falar com a Microsoft/)
  })
})

describe('entraError', () => {
  it('turns the common AADSTS codes into next steps', () => {
    expect(entraError('invalid_request', 'AADSTS50011: redirect mismatch')).toMatch(
      /http:\/\/localhost.*AADSTS50011/
    )
    expect(entraError('consent_required', 'AADSTS65001: x')).toMatch(/consentimento/)
    expect(entraError('access_denied', 'AADSTS50105: x')).toMatch(/cancelado|liberada/)
    expect(entraError('server_error', null)).toBe('A Microsoft recusou o login.')
  })
})
