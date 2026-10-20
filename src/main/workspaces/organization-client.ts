/**
 * HTTP client for one North Server (ADR 0018). Lives only in main: the access
 * token stays in memory, the refresh token goes through a `TokenStore`
 * (the vault in production). The renderer never sees either.
 */

export interface TokenStore {
  get(): string | null
  set(refreshToken: string | null): void
}

export function memoryTokenStore(initial: string | null = null): TokenStore {
  let value = initial
  return {
    get: () => value,
    set: (next) => {
      value = next
    }
  }
}

export type ServerInfo = { name: string; version: string; authModes: string[] }
export type OrganizationUser = { id: string; email: string; name: string; role: string }

/** The session is gone (revoked, user disabled, never signed in): sign in again. */
export class OrganizationSignedOutError extends Error {
  constructor() {
    super('Sua sessão nesta organização terminou. Entre de novo.')
    this.name = 'OrganizationSignedOutError'
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/** `north.acme.com/` → `https://north.acme.com`. Plain http only on loopback. */
export function normalizeServerUrl(raw: string): string {
  let text = raw.trim()
  if (!text) throw new Error('Informe o endereço do servidor')
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new Error('Endereço inválido')
  }
  if (!url.hostname || /\s/.test(raw.trim())) throw new Error('Endereço inválido')
  if (url.protocol === 'http:' && !LOOPBACK.has(url.hostname)) {
    throw new Error('Use https:// — o login trafegaria sem criptografia')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Endereço inválido')
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function probeServer(rawUrl: string): Promise<ServerInfo> {
  const base = normalizeServerUrl(rawUrl)
  let res: Response
  try {
    res = await fetch(`${base}/api/v1/info`, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error(`O servidor ${base} não respondeu. Confira o endereço e a sua rede/VPN.`)
  }
  const body = (await readJson(res)) as
    | { product?: string; name?: string; version?: string; auth?: { modes?: string[] } }
    | undefined
  if (!res.ok || body?.product !== 'north-server') {
    throw new Error(`${base} não é um North Server.`)
  }
  return {
    name: body.name ?? base,
    version: body.version ?? '?',
    authModes: body.auth?.modes ?? []
  }
}

type Pair = { accessToken: string; refreshToken: string }

export class OrganizationClient {
  private accessToken: string | null = null
  private refreshing: Promise<void> | null = null

  constructor(
    readonly baseUrl: string,
    private readonly tokens: TokenStore
  ) {}

  /** Dev-mode sign-in (phase 2). Entra OIDC lands in phase 0 behind the same session. */
  async devLogin(email: string, name?: string): Promise<OrganizationUser> {
    const res = await this.raw('POST', '/api/v1/auth/dev/login', { email, name })
    const body = (await readJson(res)) as (Pair & { user: OrganizationUser }) | undefined
    if (!res.ok || !body) throw new Error(errorMessage(body, 'Não foi possível entrar'))
    this.accept(body)
    return body.user
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens.get()
    this.accessToken = null
    this.tokens.set(null)
    if (!refreshToken) return
    await this.raw('POST', '/api/v1/auth/logout', { refreshToken }).catch(() => undefined)
  }

  /** Test hook: pretend the in-memory access token expired / was replaced. */
  forgetAccessToken(replacement: string | null = null): void {
    this.accessToken = replacement
  }

  /** A usable access token for the events channel; `fresh` forces a refresh (after a 4401). */
  async accessTokenForEvents(fresh = false): Promise<string> {
    if (fresh || !this.accessToken) await this.refresh()
    return this.accessToken as string
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.accessToken) await this.refresh()
    let res = await this.raw(method, path, body, this.accessToken)
    if (res.status === 401) {
      await this.refresh()
      res = await this.raw(method, path, body, this.accessToken)
      if (res.status === 401) {
        this.signOutLocally()
        throw new OrganizationSignedOutError()
      }
    }
    if (res.status === 204) return undefined as T
    const json = await readJson(res)
    if (!res.ok) {
      const error = new Error(errorMessage(json, `Erro ${res.status} do servidor`))
      ;(error as Error & { status?: number }).status = res.status
      throw error
    }
    return json as T
  }

  private async refresh(): Promise<void> {
    this.refreshing ??= (async () => {
      const refreshToken = this.tokens.get()
      if (!refreshToken) throw new OrganizationSignedOutError()
      const res = await this.raw('POST', '/api/v1/auth/refresh', { refreshToken })
      const body = (await readJson(res)) as Pair | undefined
      if (!res.ok || !body) {
        this.signOutLocally()
        throw new OrganizationSignedOutError()
      }
      this.accept(body)
    })().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private accept(pair: Pair): void {
    this.accessToken = pair.accessToken
    this.tokens.set(pair.refreshToken)
  }

  private signOutLocally(): void {
    this.accessToken = null
    this.tokens.set(null)
  }

  private async raw(
    method: string,
    path: string,
    body?: unknown,
    accessToken?: string | null
  ): Promise<Response> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      })
    } catch {
      throw new Error(`O servidor ${this.baseUrl} não respondeu. Confira a sua rede/VPN.`)
    }
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { error?: { message?: string } } | undefined)?.error?.message
  return message || fallback
}
