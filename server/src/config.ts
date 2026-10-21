import { z } from 'zod'
import { loadMasterKey } from './secrets/envelope'

export const AuthModeSchema = z.enum(['dev', 'entra'])
export type AuthMode = z.infer<typeof AuthModeSchema>

export type ServerConfig = {
  databaseUrl: string
  jwtSecret: string
  authModes: AuthMode[]
  accessTokenTtlSec: number
  refreshTokenTtlSec: number
  port: number
  host: string
  organizationName: string
  /** Wraps the per-secret data keys (ADR 0018 §8). Without it, org secrets are off. */
  masterKey: Buffer | null
  /** Entra ID (or another OIDC provider) when `entra` is an auth mode (ADR 0018 fase 0). */
  oidc: OidcConfig | null
}

export type OidcConfig = {
  issuer: string
  clientId: string
  /** Entra tenant; tokens from another tenant are refused. */
  tenantId: string | null
  /** Entra group object ids whose members are admins; empty = roles managed in the panel. */
  adminGroups: string[]
  /** Anyone in the tenant may sign in (as a member with no projects) vs only people added by an admin. */
  allowNewUsers: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const list = (raw: string | undefined) =>
  (raw ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

const EnvSchema = z.object({
  DATABASE_URL: z.string({ error: 'DATABASE_URL is required' }).min(1, 'DATABASE_URL is required'),
  NORTH_JWT_SECRET: z
    .string({ error: 'NORTH_JWT_SECRET is required' })
    .min(32, 'NORTH_JWT_SECRET must have at least 32 characters'),
  // ADR 0018 §6: short-lived access tokens (5–10 min); revocation rides on refresh.
  NORTH_ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(300).max(600).default(600),
  NORTH_REFRESH_TOKEN_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 3600),
  NORTH_AUTH_MODES: z
    .string()
    .default('entra')
    .transform((raw) =>
      raw
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    )
    .pipe(z.array(AuthModeSchema).min(1)),
  NORTH_ALLOW_DEV_AUTH: z.string().optional(),
  NORTH_OIDC_TENANT_ID: z.string().optional(),
  NORTH_OIDC_CLIENT_ID: z.string().optional(),
  NORTH_OIDC_ISSUER: z.string().url().optional(),
  NORTH_OIDC_ADMIN_GROUPS: z.string().optional(),
  NORTH_OIDC_ALLOW_NEW_USERS: z.enum(['0', '1']).default('1'),
  NORTH_ORGANIZATION_NAME: z.string().min(1).default('North'),
  PORT: z.coerce.number().int().nonnegative().default(8080),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().optional()
})

export function loadConfig(
  env: Record<string, string | undefined>,
  readFile?: (path: string) => string
): ServerConfig {
  const parsed = EnvSchema.safeParse(env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid configuration — ${detail}`)
  }
  const e = parsed.data
  if (
    e.NODE_ENV === 'production' &&
    e.NORTH_AUTH_MODES.includes('dev') &&
    e.NORTH_ALLOW_DEV_AUTH !== '1'
  ) {
    throw new Error(
      'Invalid configuration — the dev auth mode signs anyone in by e-mail; set NORTH_ALLOW_DEV_AUTH=1 to use it in production'
    )
  }
  const masterKey = loadMasterKey(env, readFile)
  if (e.NODE_ENV === 'production' && !masterKey) {
    throw new Error(
      'Invalid configuration — set NORTH_MASTER_KEY or NORTH_MASTER_KEY_FILE (openssl rand -base64 32) to store passwords'
    )
  }
  return {
    oidc: e.NORTH_AUTH_MODES.includes('entra') ? loadOidc(e) : null,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.NORTH_JWT_SECRET,
    authModes: e.NORTH_AUTH_MODES,
    accessTokenTtlSec: e.NORTH_ACCESS_TOKEN_TTL_SEC,
    refreshTokenTtlSec: e.NORTH_REFRESH_TOKEN_TTL_SEC,
    port: e.PORT,
    host: e.HOST,
    organizationName: e.NORTH_ORGANIZATION_NAME,
    masterKey
  }
}

function loadOidc(e: z.infer<typeof EnvSchema>): OidcConfig {
  const tenantId = e.NORTH_OIDC_TENANT_ID?.trim() || null
  const clientId = e.NORTH_OIDC_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error(
      'Invalid configuration — Entra sign-in needs NORTH_OIDC_CLIENT_ID (the Application (client) ID)'
    )
  }
  if (tenantId && !UUID.test(tenantId)) {
    throw new Error(
      'Invalid configuration — NORTH_OIDC_TENANT_ID must be the Directory (tenant) ID'
    )
  }
  if (!tenantId && !e.NORTH_OIDC_ISSUER) {
    throw new Error(
      'Invalid configuration — Entra sign-in needs NORTH_OIDC_TENANT_ID (the Directory (tenant) ID)'
    )
  }
  return {
    issuer: (e.NORTH_OIDC_ISSUER ?? `https://login.microsoftonline.com/${tenantId}/v2.0`).replace(
      /\/+$/,
      ''
    ),
    clientId,
    tenantId,
    adminGroups: list(e.NORTH_OIDC_ADMIN_GROUPS),
    allowNewUsers: e.NORTH_OIDC_ALLOW_NEW_USERS === '1'
  }
}
