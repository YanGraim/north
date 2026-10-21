import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { memoryTokenStore, OrganizationClient } from '../workspaces/organization-client'
import { RemoteInventoryStore } from '../workspaces/remote-inventory-store'
import { RemoteSecretStore } from '../workspaces/secret-store'
import { startTestServer } from '../workspaces/test-server'
import { importInventoryCsv } from './inventory-csv-import'

/** CSV import into an organization: rows go to the real North Server. */
let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
}, 60_000)
afterAll(() => server.stop())

const HEADER =
  'tipo,cliente,ambiente,grupo,nome,protocolo,engine,host,porta,database,url,usuario,senha,notas,tags'

async function signedIn(email: string, admin = true) {
  const client = new OrganizationClient(server.url, memoryTokenStore())
  await client.devLogin(email)
  if (admin) await server.makeAdmin(email)
  return {
    inventory: new RemoteInventoryStore(client),
    secrets: new RemoteSecretStore(client),
    accesses: null
  }
}

describe('importInventoryCsv into an organization', () => {
  it('creates the tree, connections, tags and server-side passwords', async () => {
    const target = await signedIn('csv-admin@acme.com')
    const csv = [
      HEADER,
      'servidor,CsvCo,Prod,Web,web-01,ssh,,10.0.0.1,22,,,ubuntu,s3cret,,linux;prod',
      'servidor,csvco,prod,web,web-02,rdp,,10.0.0.2,,,,admin,,,',
      ''
    ].join('\n')
    const report = await importInventoryCsv(target, csv, { allowSecrets: true })
    expect(report.errors).toEqual([])
    expect(report.created).toMatchObject({ clients: 1, environments: 1, groups: 1, connections: 2 })

    const client = (await target.inventory.clients.list()).find((c) => c.name === 'CsvCo')
    expect(client).toBeTruthy()
    const connections = await target.inventory.connections.list({ clientId: client?.id })
    const web01 = connections.find((c) => c.name === 'web-01')
    expect(web01?.credentialRef).toBeTruthy()
    expect(await target.secrets.resolve(web01?.credentialRef as string, 'reveal')).toBe('s3cret')
    expect(connections.find((c) => c.name === 'web-02')?.port).toBe(3389)
    const tags = await target.inventory.tags.listForConnection(web01?.id as string)
    expect(tags.map((t) => t.name).sort()).toEqual(['linux', 'prod'])
  })

  it('reports accesses (banco/login) as not available yet, line by line', async () => {
    const target = await signedIn('csv-admin2@acme.com')
    const csv = [
      HEADER,
      'banco,AccCo,Prod,Db,pg,,postgres,10.0.0.3,5432,app,,app,,,',
      'login,AccCo,Prod,Db,portal,,,,,,https://x.example,ana,,,',
      'servidor,AccCo,Prod,Db,db-01,ssh,,10.0.0.3,22,,,root,,,',
      ''
    ].join('\n')
    const report = await importInventoryCsv(target, csv, { allowSecrets: false })
    expect(report.created.connections).toBe(1)
    expect(report.created.accesses).toBe(0)
    expect(report.errors).toHaveLength(2)
    expect(report.errors[0]).toMatch(/^Linha 2: acessos .* Meu workspace/)
  })

  it('a member without access gets a per-line error, nothing half-created', async () => {
    const target = await signedIn('csv-member@acme.com', false)
    const csv = [HEADER, 'servidor,NoCo,Prod,Web,x,ssh,,10.0.0.1,22,,,u,,,', ''].join('\n')
    const report = await importInventoryCsv(target, csv, { allowSecrets: false })
    expect(report.created.connections).toBe(0)
    expect(report.errors[0]).toMatch(/^Linha 2: cliente “NoCo”/)
  })

  it('importing twice skips what already exists and drops the duplicate password', async () => {
    const target = await signedIn('csv-admin3@acme.com')
    const csv = [HEADER, 'servidor,TwiceCo,Prod,Web,w,ssh,,10.0.0.1,22,,,u,pw,,', ''].join('\n')
    await importInventoryCsv(target, csv, { allowSecrets: true })
    const before = await server.db.query<{ n: number }>('SELECT count(*)::int AS n FROM secrets')
    const again = await importInventoryCsv(target, csv, { allowSecrets: true })
    expect(again.skipped.connections).toBe(1)
    const after = await server.db.query<{ n: number }>('SELECT count(*)::int AS n FROM secrets')
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })
})
