import { createHash, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/** What the North Server publishes in `/api/v1/info` for Entra sign-in. */
export type OidcInfo = {
  clientId: string
  scopes: string[]
  authorizationEndpoint: string | null
  tokenEndpoint: string | null
}

export class SignInCancelledError extends Error {
  constructor() {
    super('Login cancelado.')
    this.name = 'SignInCancelledError'
  }
}

const PAGE = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>North</title>
<style>body{font:15px system-ui,sans-serif;background:#0a0e17;color:#e8edf7;display:grid;place-items:center;height:90vh;margin:0}main{text-align:center;max-width:420px}p{color:#8b97ad}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`

const DONE = PAGE(
  'Pronto — pode voltar ao North',
  'Login concluído. Você já pode fechar esta aba. · Signed in, you can close this tab.'
)
const FAILED = PAGE(
  'Não deu certo',
  'Volte ao North para ver o motivo. · Go back to North to see why.'
)

const b64url = (bytes: Buffer) => bytes.toString('base64url')

/**
 * Entra sign-in for a desktop app (RFC 8252): the system browser opens the
 * Microsoft page, which redirects to a one-shot loopback listener in main;
 * main redeems the code with PKCE (public client, no secret) and returns the
 * id_token for the North Server to check. Nothing reaches the renderer.
 *
 * The redirect is `http://localhost:<port>` — Entra matches loopback redirect
 * URIs ignoring the port, so the app registration only needs `http://localhost`.
 */
export async function signInWithBrowser(
  info: OidcInfo,
  deps: {
    openBrowser: (url: string) => Promise<void> | void
    signal?: AbortSignal
    timeoutMs?: number
    loginHint?: string
  }
): Promise<{ idToken: string; nonce: string }> {
  if (!info.authorizationEndpoint || !info.tokenEndpoint) {
    throw new Error(
      'O servidor não conseguiu falar com a Microsoft agora. Tente de novo em instantes.'
    )
  }
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))
  const nonce = b64url(randomBytes(16))

  const servers: Server[] = []
  let settle: { resolve: (code: string) => void; reject: (error: Error) => void } | null = null
  const codePromise = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // It may settle while the browser is still opening; it is awaited right after.
  codePromise.catch(() => undefined)

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/' || (!url.searchParams.has('code') && !url.searchParams.has('error'))) {
      res.writeHead(404).end()
      return
    }
    // A stray or forged redirect (wrong state) must not end the wait.
    if (url.searchParams.get('state') !== state) {
      res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }).end(FAILED)
      return
    }
    const error = url.searchParams.get('error')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(error ? FAILED : DONE)
    if (error) {
      settle?.reject(new Error(entraError(error, url.searchParams.get('error_description'))))
    } else {
      settle?.resolve(url.searchParams.get('code') as string)
    }
  }

  const listen = (server: Server, host: string, port: number) =>
    new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => resolve((server.address() as AddressInfo).port))
    })

  const v4 = createServer(handler)
  servers.push(v4)
  const port = await listen(v4, '127.0.0.1', 0)
  // `localhost` may resolve to ::1 in the browser; listen there too when the OS has IPv6.
  const v6 = createServer(handler)
  await listen(v6, '::1', port)
    .then(() => servers.push(v6))
    .catch(() => undefined)
  const redirectUri = `http://localhost:${port}`

  const timeout = setTimeout(
    () => settle?.reject(new Error('O login demorou demais. Tente de novo.')),
    deps.timeoutMs ?? 5 * 60_000
  )
  const onAbort = () => settle?.reject(new SignInCancelledError())
  deps.signal?.addEventListener('abort', onAbort)

  try {
    if (deps.signal?.aborted) throw new SignInCancelledError()
    const authorize = new URL(info.authorizationEndpoint)
    authorize.search = new URLSearchParams({
      client_id: info.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: info.scopes.join(' '),
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
      ...(deps.loginHint ? { login_hint: deps.loginHint } : {})
    }).toString()
    await deps.openBrowser(authorize.toString())
    const code = await codePromise

    let res: Response
    try {
      res = await fetch(info.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: info.clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          scope: info.scopes.join(' ')
        }),
        signal: AbortSignal.timeout(15_000)
      })
    } catch {
      throw new Error('A Microsoft não respondeu. Confira a sua rede/VPN.')
    }
    const body = (await res.json().catch(() => ({}))) as {
      id_token?: string
      error?: string
      error_description?: string
    }
    if (!res.ok || !body.id_token) {
      throw new Error(entraError(body.error ?? 'invalid_grant', body.error_description ?? null))
    }
    return { idToken: body.id_token, nonce }
  } finally {
    clearTimeout(timeout)
    deps.signal?.removeEventListener('abort', onAbort)
    for (const server of servers) {
      server.closeAllConnections()
      server.close()
    }
  }
}

/** Entra error codes → something a person can act on (AADSTS code kept for the admin). */
export function entraError(error: string, description: string | null): string {
  const code = description?.match(/AADSTS\d+/)?.[0]
  const suffix = code ? ` (${code})` : ''
  if (error === 'access_denied') {
    return `Login cancelado ou negado na Microsoft${suffix}.`
  }
  if (code === 'AADSTS50011') {
    return `O endereço de retorno não está cadastrado no app do Entra — peça ao admin para adicionar http://localhost em "Mobile and desktop applications"${suffix}.`
  }
  if (code === 'AADSTS65001' || code === 'AADSTS90094') {
    return `Um admin do Entra precisa dar consentimento ao North antes do primeiro login${suffix}.`
  }
  if (code === 'AADSTS50105') {
    return `Sua conta não foi liberada para usar o North no Entra — fale com o admin${suffix}.`
  }
  if (code === 'AADSTS7000218') {
    return `O app do Entra precisa permitir "public client flows" — fale com o admin${suffix}.`
  }
  return `A Microsoft recusou o login${suffix}.`
}
