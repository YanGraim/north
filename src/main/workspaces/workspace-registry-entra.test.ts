import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type FakeOidcProvider, startFakeOidc } from '../../../server/src/dev/fake-oidc'
import { createTestDatabase } from '../database/test-utils'
import { createRepositories } from '../repositories'
import { WorkspacesRepository } from '../repositories/workspaces-repository'
import { CredentialVault, FakeEncryptor } from '../vault'
import { startTestServer } from './test-server'
import { WorkspaceRegistry } from './workspace-registry'

/** Organizations whose North Server signs in with Entra (fake provider, real server). */
let idp: FakeOidcProvider
let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  idp = await startFakeOidc()
  server = await startTestServer({
    authModes: ['entra'],
    oidc: {
      issuer: idp.issuer,
      clientId: idp.clientId,
      tenantId: idp.tenantId,
      adminGroups: [],
      allowNewUsers: true
    }
  })
}, 60_000)

afterAll(async () => {
  await server.stop()
  await idp.close()
})

/** The system browser: follows Microsoft's redirect back to main's loopback. */
const browser = async (url: string) => {
  const page = await fetch(url, { redirect: 'manual' })
  await fetch(page.headers.get('location') as string)
}

function setup(openBrowser: (url: string) => Promise<void> | void = (url) => void browser(url)) {
  const db = createTestDatabase()
  const local = createRepositories(db)
  const workspaces = new WorkspacesRepository(db)
  const vault = new CredentialVault(local.credentials, new FakeEncryptor())
  const opened: string[] = []
  const registry = new WorkspaceRegistry({
    workspaces,
    local,
    vault,
    liveEvents: false,
    openBrowser: (url) => {
      opened.push(url)
      return openBrowser(url)
    }
  })
  return { registry, workspaces, opened }
}

describe('WorkspaceRegistry — Entra organizations', () => {
  it('probe says the server offers Microsoft sign-in, without leaking endpoints', async () => {
    const { registry } = setup()
    const info = await registry.probe(server.url)
    expect(info).toEqual({
      name: 'Acme Test',
      version: expect.any(String),
      authModes: ['entra'],
      entra: true
    })
  })

  it('signs in through the browser and saves the organization with the Entra e-mail', async () => {
    const { registry, opened } = setup()
    idp.signInAs({ email: 'Ana@Acme.com', name: 'Ana' })
    const org = await registry.addOrganization({ serverUrl: server.url })
    expect(opened).toHaveLength(1)
    expect(opened[0]).toContain(`${idp.issuer.replace('/v2.0', '')}/oauth2/v2.0/authorize`)
    expect(org.userEmail).toBe('ana@acme.com')
    expect((await registry.activate(org.id)).id).toBe(org.id)
  })

  it('saves nothing when the person cancels in the browser', async () => {
    const { registry, workspaces } = setup(() => {
      setTimeout(() => registry.cancelSignIn(), 10)
    })
    await expect(registry.addOrganization({ serverUrl: server.url })).rejects.toThrow(/cancelado/)
    expect(workspaces.list().filter((w) => w.kind === 'organization')).toEqual([])
  })

  it('refuses the e-mail sign-in on an Entra-only server', async () => {
    const { registry } = setup()
    await expect(
      registry.addOrganization({ serverUrl: server.url, email: 'x@acme.com' })
    ).rejects.toThrow(/só aceita login pela Microsoft/)
  })

  it('signing in again reuses the same workspace', async () => {
    const { registry } = setup()
    idp.signInAs({ email: 'bia@acme.com' })
    const a = await registry.addOrganization({ serverUrl: server.url })
    idp.signInAs({ email: 'bia@acme.com' })
    const b = await registry.addOrganization({ serverUrl: server.url })
    expect(b.id).toBe(a.id)
    expect(registry.list().filter((w) => w.kind === 'organization')).toHaveLength(1)
  })
})
