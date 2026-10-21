import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose'
import type { OidcConfig } from '../config'
import { unauthorized } from '../errors'

export type OidcMetadata = {
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
}

/** Who Entra says signed in. `subject` is stable per person (object id), the e-mail is not. */
export type OidcIdentity = {
  subject: string
  email: string
  name: string
  /** Null when the token has no groups claim (not configured, or over Entra's limit). */
  groups: string[] | null
}

const SCOPES = ['openid', 'profile', 'email']

/**
 * Checks the id_token the desktop or the admin panel got from Entra: signature
 * (provider's JWKS), issuer, audience (our client id), tenant and nonce. The
 * server never sees a password or a Microsoft refresh token.
 */
export class OidcVerifier {
  private metadataPromise: Promise<OidcMetadata> | null = null
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null

  constructor(readonly config: OidcConfig) {}

  get scopes(): string[] {
    return SCOPES
  }

  metadata(): Promise<OidcMetadata> {
    this.metadataPromise ??= (async () => {
      const res = await fetch(`${this.config.issuer}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`)
      const doc = (await res.json()) as {
        authorization_endpoint: string
        token_endpoint: string
        jwks_uri: string
      }
      return {
        authorizationEndpoint: doc.authorization_endpoint,
        tokenEndpoint: doc.token_endpoint,
        jwksUri: doc.jwks_uri
      }
    })().catch((error) => {
      // A provider that was down at boot must not stay broken until a restart.
      this.metadataPromise = null
      throw error
    })
    return this.metadataPromise
  }

  async verify(idToken: string, nonce: string): Promise<OidcIdentity> {
    const { jwksUri } = await this.metadata()
    this.jwks ??= createRemoteJWKSet(new URL(jwksUri))
    let payload: JWTPayload
    try {
      ;({ payload } = await jwtVerify(idToken, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.clientId,
        algorithms: ['RS256'],
        clockTolerance: 60
      }))
    } catch {
      throw unauthorized('Invalid Entra sign-in')
    }
    if (payload.nonce !== nonce) throw unauthorized('Invalid Entra sign-in')
    if (this.config.tenantId && payload.tid !== this.config.tenantId) {
      throw unauthorized('This account belongs to another organization')
    }
    const subject = String(payload.oid ?? payload.sub ?? '')
    const email = String(payload.email ?? payload.preferred_username ?? payload.upn ?? '')
      .trim()
      .toLowerCase()
    if (!subject || !email.includes('@'))
      throw unauthorized('Entra sent no e-mail for this account')
    // `_claim_names.groups` = more groups than fit the token; don't guess roles then.
    const groups = Array.isArray(payload.groups) ? payload.groups.map(String) : null
    return { subject, email, name: String(payload.name ?? ''), groups }
  }
}
