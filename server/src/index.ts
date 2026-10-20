import { buildApp } from './app'
import { loadConfig } from './config'
import { createPgDb } from './db'
import { migrate } from './migrations'

const config = loadConfig(process.env)
const db = createPgDb(config.databaseUrl)
await migrate(db)
const app = await buildApp({ db, config })
await app.listen({ port: config.port, host: config.host })
console.log(`north-server listening on http://${config.host}:${config.port}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close()
    await db.close()
    process.exit(0)
  })
}
