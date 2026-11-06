import { PGlite } from '@electric-sql/pglite'
import { buildApp } from './app'
import { createPgliteDb } from './db'
import { startFakeOidc } from './dev/fake-oidc'
import { migrate } from './migrations'
import { createAccess } from './store/accesses'
import { createClient, createConnection, createEnvironment, createGroup } from './store/inventory'
import { upsertUserByEmail } from './store/users'
import { TEST_CONFIG } from './test-utils'

/**
 * Throwaway North Server for UI tests (Playwright): in-memory Postgres, dev
 * sign-in, and a tiny seed — `admin@north.test` (first user, so admin) and the
 * tree Acme → Prod → Web { web-01, web-02 } / Db { pg-01, the pg-prod database access }.
 */
const port = Number(process.env.PORT ?? 5181)
const db = createPgliteDb(new PGlite())
await migrate(db)
const admin = await upsertUserByEmail(db, 'admin@north.test', 'Admin')
const acme = await createClient(db, { name: 'Acme' })
const prod = await createEnvironment(db, { clientId: acme.id, name: 'Prod' })
const web = await createGroup(db, { environmentId: prod.id, name: 'Web' })
const dbGroup = await createGroup(db, { environmentId: prod.id, name: 'Db' })
const ssh = (groupId: string, name: string, host: string) =>
  createConnection(db, admin?.id ?? '', {
    groupId,
    name,
    protocol: 'ssh',
    host,
    port: 22,
    authMethod: 'password'
  })
await ssh(web.id, 'web-01', '10.0.1.11')
await ssh(web.id, 'web-02', '10.0.1.12')
await ssh(dbGroup.id, 'pg-01', '10.0.2.21')
await createAccess(db, admin?.id ?? '', {
  groupId: dbGroup.id,
  type: 'database',
  name: 'pg-prod',
  engine: 'postgres',
  host: '10.0.2.21',
  port: 5432
})

// NORTH_FAKE_ENTRA=<port>: also sign in with "Microsoft" through the fake provider.
const fakeEntraPort = process.env.NORTH_FAKE_ENTRA ? Number(process.env.NORTH_FAKE_ENTRA) : null
const idp = fakeEntraPort ? await startFakeOidc({ port: fakeEntraPort }) : null
const app = await buildApp({
  db,
  config: {
    ...TEST_CONFIG,
    organizationName: 'Acme Test',
    ...(idp
      ? {
          authModes: ['dev', 'entra'],
          oidc: {
            issuer: idp.issuer,
            clientId: idp.clientId,
            tenantId: idp.tenantId,
            adminGroups: [],
            allowNewUsers: true
          }
        }
      : {})
  }
})
await app.listen({ port, host: '127.0.0.1' })
console.log(
  `north-server (pglite) on http://127.0.0.1:${port}${idp ? ` · fake Entra ${idp.issuer}` : ''}`
)
