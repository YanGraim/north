import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose'

/**
 * A tiny OpenID Connect provider shaped like Entra ID (ADR 0018 fase 0), for
 * tests and local dev only — never bundled into the server. Authorization
 * code + PKCE, an RS256 id_token with Entra's claims (oid, tid,
 * preferred_username, groups), discovery and JWKS.
 */
export type FakeUser = {
  email: string
  name?: string
  /** Entra object id; defaults to a stable id derived from the e-mail. */
  oid?: string
  groups?: string[]
}

type PendingCode = {
  user: FakeUser
  clientId: string
  redirectUri: string
  challenge: string
  nonce?: string
}

export type FakeOidcProvider = {
  issuer: string
  tenantId: string
  clientId: string
  /** The next /authorize signs this person in without showing the form. */
  signInAs(user: FakeUser | null): void
  /** Mints an id_token directly (server unit tests). */
  idToken(user: FakeUser, overrides?: Record<string, unknown>): Promise<string>
  close(): Promise<void>
}

export const FAKE_TENANT_ID = '11111111-2222-3333-4444-555555555555'
export const FAKE_CLIENT_ID = 'north-desktop-test'

const oidFor = (email: string) => {
  const hex = createHash('sha256').update(email.toLowerCase()).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function startFakeOidc(
  options: { port?: number; tenantId?: string; clientId?: string; host?: string } = {}
): Promise<FakeOidcProvider> {
  const tenantId = options.tenantId ?? FAKE_TENANT_ID
  const clientId = options.clientId ?? FAKE_CLIENT_ID
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const kid = randomUUID()
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' }
  const codes = new Map<string, PendingCode>()
  let autoUser: FakeUser | null = null
  let issuer = ''

  const sign = (user: FakeUser, audience: string, extra: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({
      oid: user.oid ?? oidFor(user.email),
      tid: tenantId,
      preferred_username: user.email,
      name: user.name ?? user.email.split('@')[0],
      ...(user.groups ? { groups: user.groups } : {}),
      ver: '2.0',
      iat: now,
      exp: now + 3600,
      ...extra
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(`sub-${user.oid ?? oidFor(user.email)}`)
      .sign(privateKey)
  }

  const finish = (res: ServerResponse, query: URLSearchParams, user: FakeUser) => {
    const redirectUri = query.get('redirect_uri') ?? ''
    const code = randomBytes(16).toString('hex')
    codes.set(code, {
      user,
      clientId: query.get('client_id') ?? '',
      redirectUri,
      challenge: query.get('code_challenge') ?? '',
      nonce: query.get('nonce') ?? undefined
    })
    const target = new URL(redirectUri)
    target.searchParams.set('code', code)
    const state = query.get('state')
    if (state) target.searchParams.set('state', state)
    res.writeHead(302, { location: target.toString() }).end()
  }

  const readBody = (req: IncomingMessage) =>
    new Promise<URLSearchParams>((resolve) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => resolve(new URLSearchParams(raw)))
    })

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res
      .writeHead(status, {
        'content-type': 'application/json',
        // Like Entra for SPA redirect URIs: the admin panel redeems from the browser.
        'access-control-allow-origin': '*'
      })
      .end(JSON.stringify(body))
  }

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer)
    const path = url.pathname.replace(`/${tenantId}`, '')
    if (req.method === 'OPTIONS') {
      res
        .writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers': 'content-type'
        })
        .end()
      return
    }
    if (path === '/v2.0/.well-known/openid-configuration') {
      return json(res, 200, {
        issuer,
        authorization_endpoint: `${issuer.replace('/v2.0', '')}/oauth2/v2.0/authorize`,
        token_endpoint: `${issuer.replace('/v2.0', '')}/oauth2/v2.0/token`,
        jwks_uri: `${issuer.replace('/v2.0', '')}/discovery/v2.0/keys`,
        response_types_supported: ['code'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256']
      })
    }
    if (path === '/discovery/v2.0/keys') return json(res, 200, { keys: [jwk] })
    if (path === '/oauth2/v2.0/authorize' && req.method === 'GET') {
      if (url.searchParams.get('client_id') !== clientId) {
        return json(res, 400, { error: 'unauthorized_client' })
      }
      if (autoUser) {
        const user = autoUser
        autoUser = null
        return finish(res, url.searchParams, user)
      }
      const hidden = [...url.searchParams]
        .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
        .join('')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        `<!doctype html><title>Fake Entra</title><form method="post">${hidden}
<label>E-mail <input name="fake_email" value="${escapeHtml(url.searchParams.get('login_hint') ?? '')}"></label>
<label>Nome <input name="fake_name"></label>
<label>Grupos <input name="fake_groups"></label>
<button>Entrar</button></form>`
      )
      return
    }
    if (path === '/oauth2/v2.0/authorize' && req.method === 'POST') {
      const form = await readBody(req)
      const groups = (form.get('fake_groups') ?? '').split(',').map((g) => g.trim())
      return finish(res, form, {
        email: form.get('fake_email') ?? '',
        name: form.get('fake_name') || undefined,
        groups: groups.filter(Boolean)
      })
    }
    if (path === '/oauth2/v2.0/token' && req.method === 'POST') {
      const form = await readBody(req)
      const pending = codes.get(form.get('code') ?? '')
      codes.delete(form.get('code') ?? '')
      const verifier = form.get('code_verifier') ?? ''
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      if (
        !pending ||
        form.get('grant_type') !== 'authorization_code' ||
        form.get('client_id') !== pending.clientId ||
        form.get('redirect_uri') !== pending.redirectUri ||
        challenge !== pending.challenge
      ) {
        return json(res, 400, { error: 'invalid_grant' })
      }
      const idToken = await sign(
        pending.user,
        pending.clientId,
        pending.nonce ? { nonce: pending.nonce } : {}
      )
      return json(res, 200, {
        token_type: 'Bearer',
        id_token: idToken,
        access_token: 'fake-graph-token',
        expires_in: 3600
      })
    }
    res.writeHead(404).end()
  })

  await new Promise<void>((resolve) =>
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve)
  )
  const { port } = server.address() as AddressInfo
  issuer = `http://127.0.0.1:${port}/${tenantId}/v2.0`

  return {
    issuer,
    tenantId,
    clientId,
    signInAs: (user) => {
      autoUser = user
    },
    idToken: (user, overrides = {}) => {
      const { aud, ...rest } = overrides
      return sign(user, typeof aud === 'string' ? aud : clientId, rest)
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}
