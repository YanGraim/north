import { PGlite } from '@electric-sql/pglite'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import type { ServerConfig } from './config'
import { createPgliteDb, type Db } from './db'
import { migrate } from './migrations'

export const TEST_CONFIG: ServerConfig = {
  databaseUrl: 'pglite://memory',
  jwtSecret: 'test-secret-test-secret-test-secret-42',
  authModes: ['dev'],
  accessTokenTtlSec: 600,
  refreshTokenTtlSec: 30 * 24 * 3600,
  port: 0,
  host: '127.0.0.1',
  organizationName: 'Acme Test',
  masterKey: Buffer.alloc(32, 42)
}

let template: Promise<PGlite> | null = null

/** Booting PGlite is slow; migrate once per worker and hand each test a clone. */
export async function createTestDb(): Promise<Db> {
  template ??= (async () => {
    const pglite = new PGlite()
    await migrate(createPgliteDb(pglite))
    return pglite
  })()
  return createPgliteDb((await (await template).clone()) as PGlite)
}

export async function createTestApp(
  overrides: Partial<ServerConfig> = {}
): Promise<{ app: FastifyInstance; db: Db }> {
  const db = await createTestDb()
  const app = await buildApp({ db, config: { ...TEST_CONFIG, ...overrides } })
  return { app, db }
}

export async function login(
  app: FastifyInstance,
  email = 'ana@acme.com'
): Promise<{ accessToken: string; refreshToken: string; auth: { authorization: string } }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/dev/login',
    payload: { email, name: email.split('@')[0] }
  })
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`)
  const body = res.json()
  return { ...body, auth: { authorization: `Bearer ${body.accessToken}` } }
}
