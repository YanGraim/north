import type { AddressInfo } from 'node:net'
import { createTestApp } from '../../../server/src/test-utils'

/**
 * Boots the real North Server (PGlite) on a loopback port so main's remote
 * client is tested against the actual API, not a hand-written fake.
 */
export async function startTestServer(): Promise<{
  url: string
  app: Awaited<ReturnType<typeof createTestApp>>['app']
  db: Awaited<ReturnType<typeof createTestApp>>['db']
  stop: () => Promise<void>
}> {
  const { app, db } = await createTestApp()
  await app.listen({ port: 0, host: '127.0.0.1' })
  const { port } = app.server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}`, app, db, stop: () => app.close() }
}
