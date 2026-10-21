import type { AddressInfo } from 'node:net'
import { createTestApp } from '../../../server/src/test-utils'

/**
 * Boots the real North Server (PGlite) on a loopback port so main's remote
 * client is tested against the actual API, not a hand-written fake.
 */
export async function startTestServer(
  overrides: Parameters<typeof createTestApp>[0] = {}
): Promise<{
  url: string
  app: Awaited<ReturnType<typeof createTestApp>>['app']
  db: Awaited<ReturnType<typeof createTestApp>>['db']
  stop: () => Promise<void>
  /** Members only see what they are granted (phase 3); most tests just need an admin. */
  makeAdmin: (email: string) => Promise<void>
}> {
  const { app, db } = await createTestApp(overrides)
  await app.listen({ port: 0, host: '127.0.0.1' })
  const { port } = app.server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    app,
    db,
    stop: () => app.close(),
    makeAdmin: async (email) => {
      await db.query("UPDATE users SET role = 'admin' WHERE email = $1", [email])
    }
  }
}
