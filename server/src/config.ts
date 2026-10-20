import { z } from 'zod'

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
}

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
  NORTH_ORGANIZATION_NAME: z.string().min(1).default('North'),
  PORT: z.coerce.number().int().nonnegative().default(8080),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().optional()
})

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
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
  return {
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.NORTH_JWT_SECRET,
    authModes: e.NORTH_AUTH_MODES,
    accessTokenTtlSec: e.NORTH_ACCESS_TOKEN_TTL_SEC,
    refreshTokenTtlSec: e.NORTH_REFRESH_TOKEN_TTL_SEC,
    port: e.PORT,
    host: e.HOST,
    organizationName: e.NORTH_ORGANIZATION_NAME
  }
}
