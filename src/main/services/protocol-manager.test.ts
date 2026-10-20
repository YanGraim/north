import { EventEmitter } from 'node:events'
import type {
  ConnectOptions,
  ProtocolDriver,
  ProtocolSession,
  SessionDataPort,
  SessionState
} from '@shared/protocols'
import type { Connection } from '@shared/types'
import type { MessagePortMain } from 'electron'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { migrate } from '../database/migrate'
import { migrations } from '../database/migrations'
import { createRepositories } from '../repositories'
import { CredentialVault, FakeEncryptor } from '../vault'
import { ProtocolManager } from './protocol-manager'

class FakePort extends EventEmitter {
  start(): void {
    // no-op
  }
  close(): void {
    this.emit('close')
  }
  postMessage(_message: unknown): void {
    // no-op
  }
}

class FakeSession implements ProtocolSession {
  readonly id: string
  readonly kind = 'terminal' as const
  readonly protocol = 'ssh'
  state: SessionState = 'connecting'
  port: SessionDataPort | null = null

  constructor(id: string) {
    this.id = id
  }

  attachPort(port: SessionDataPort): void {
    this.port = port
    port.start()
  }

  async dispose(): Promise<void> {
    this.state = 'closed'
    this.port?.close()
  }
}

class FakeDriver implements ProtocolDriver {
  readonly id = 'fake-ssh'
  readonly protocols = ['ssh']
  readonly kind = 'terminal' as const
  fail = false
  requireSecret = false
  requireHostKey = false
  lastVerifyAccepted: boolean | null = null

  async createSession(opts: ConnectOptions): Promise<ProtocolSession> {
    if (this.requireSecret) {
      if (!opts.connection.credentialRef) {
        throw new Error('Senha não configurada para esta conexão')
      }
      await opts.resolveSecret(opts.connection.credentialRef)
    }

    if (this.requireHostKey) {
      const accepted = await opts.verifyHostKey({
        host: opts.connection.host,
        port: opts.connection.port,
        keyType: 'ssh-ed25519',
        fingerprint: 'SHA256:testhost',
        hostKey: new Uint8Array([1, 2, 3])
      })
      this.lastVerifyAccepted = accepted
      if (!accepted) {
        throw new Error('Host key rejected')
      }
    }

    if (this.fail) {
      throw new Error('auth failed')
    }
    const session = new FakeSession(opts.sessionId)
    session.state = 'connected'
    return session
  }
}

describe('ProtocolManager', () => {
  const dbs: Array<ReturnType<typeof openDatabase>> = []

  afterEach(() => {
    for (const db of dbs) db.close()
    dbs.length = 0
  })

  function setup(): {
    manager: ProtocolManager
    driver: FakeDriver
    repos: ReturnType<typeof createRepositories>
  } {
    const db = openDatabase(':memory:')
    dbs.push(db)
    migrate(db, migrations)
    const repos = createRepositories(db)
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    const manager = new ProtocolManager(repos, vault, () => {
      const port1 = new FakePort() as unknown as MessagePortMain
      const port2 = new FakePort() as unknown as MessagePortMain
      return { port1, port2 }
    })
    const driver = new FakeDriver()
    manager.register(driver)
    return { manager, driver, repos }
  }

  function seedConnection(repos: ReturnType<typeof createRepositories>): string {
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const connection = repos.connections.create({
      groupId: group.id,
      name: 'ssh-box',
      protocol: 'ssh',
      host: '127.0.0.1',
      port: 22,
      authMethod: 'none'
    })
    return connection.id
  }

  function gateRecorder(fail = false) {
    const calls: string[] = []
    return {
      calls,
      gate: {
        profileForConnection: () => 'poly',
        profileForAccess: () => null,
        ensure: async (profileId: string | null, holder: string) => {
          calls.push(`ensure ${profileId} ${holder.slice(0, 4)}`)
          if (fail) throw new Error('VPN POLY: Chave pré-compartilhada incorreta')
        },
        release: (holder: string) => {
          calls.push(`release ${holder.slice(0, 4)}`)
        }
      }
    }
  }

  it('brings the VPN up before the driver and releases it when the session closes', async () => {
    const { manager, repos, driver } = setup()
    const { gate, calls } = gateRecorder()
    manager.setVpnGate(gate)
    const order: string[] = []
    const create = driver.createSession.bind(driver)
    driver.createSession = async (opts) => {
      order.push(`driver after ${calls.length} gate call(s)`)
      return create(opts)
    }
    const { descriptor } = await manager.open(seedConnection(repos), crypto.randomUUID())
    expect(order).toEqual(['driver after 1 gate call(s)'])
    await manager.close(descriptor.id)
    const id = descriptor.id.slice(0, 4)
    expect(calls).toEqual([`ensure poly ${id}`, `release ${id}`])
  })

  it('a VPN failure fails the session with its message and never calls the driver', async () => {
    const { manager, repos, driver } = setup()
    const { gate } = gateRecorder(true)
    manager.setVpnGate(gate)
    let driverCalled = false
    driver.createSession = async () => {
      driverCalled = true
      throw new Error('unreachable')
    }
    await expect(manager.open(seedConnection(repos), crypto.randomUUID())).rejects.toThrow(
      'VPN POLY: Chave pré-compartilhada incorreta'
    )
    expect(driverCalled).toBe(false)
    expect(manager.list()).toEqual([])
  })

  describe('connection source (organizations)', () => {
    const orgConnection: Connection = {
      id: '7e57c0de-0000-4000-8000-000000000001',
      groupId: '7e57c0de-0000-4000-8000-000000000002',
      name: 'org-box',
      description: null,
      protocol: 'ssh',
      host: '10.9.9.9',
      port: 22,
      username: 'root',
      authMethod: 'password',
      credentialRef: '7e57c0de-0000-4000-8000-0000000000aa',
      privateKeyPath: null,
      jumpHostId: null,
      defaultCommand: null,
      notes: null,
      os: null,
      icon: null,
      color: null,
      owner: null,
      links: [],
      vpnRequired: false,
      vpnMode: 'inherit',
      vpnProfileId: null,
      checklist: [],
      relatedFiles: [],
      isFavorite: false,
      accessCount: 0,
      totalConnectedMs: 0,
      lastConnectedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    function orgSource() {
      const reads: string[] = []
      return {
        reads,
        source: {
          connection: async (id: string) => (id === orgConnection.id ? { ...orgConnection } : null),
          resolveSecret: async (ref: string) => {
            reads.push(ref)
            return 'org-password'
          },
          vpnProfile: () => null
        }
      }
    }

    it('opens a connection that only exists on the server, fetching the password just in time', async () => {
      const { manager, driver } = setup()
      const { source, reads } = orgSource()
      manager.setConnectionSource(() => source)
      driver.requireSecret = true
      let resolved: string | null = null
      const create = driver.createSession.bind(driver)
      driver.createSession = async (opts) => {
        resolved = await opts.resolveSecret(opts.connection.credentialRef as string)
        return create(opts)
      }
      const { descriptor } = await manager.open(orgConnection.id, crypto.randomUUID())
      expect(descriptor).toMatchObject({ state: 'connected', title: 'org-box' })
      expect(resolved).toBe('org-password')
      expect(reads.every((ref) => ref === orgConnection.credentialRef)).toBe(true)
    })

    it('reports a connection missing from the source', async () => {
      const { manager } = setup()
      manager.setConnectionSource(() => orgSource().source)
      await expect(
        manager.open('7e57c0de-0000-4000-8000-0000000000ff', crypto.randomUUID())
      ).rejects.toThrow('Conexão não encontrada')
    })

    it('asks the source for the VPN, not the local inventory', async () => {
      const { manager } = setup()
      const { gate, calls } = gateRecorder()
      manager.setVpnGate(gate)
      manager.setConnectionSource(() => orgSource().source)
      const { descriptor } = await manager.open(orgConnection.id, crypto.randomUUID())
      expect(calls[0]).toBe(`ensure null ${descriptor.id.slice(0, 4)}`)
    })

    it('a session that fails in an organization still tears down cleanly', async () => {
      const { manager, driver } = setup()
      manager.setConnectionSource(() => orgSource().source)
      driver.fail = true
      await expect(manager.open(orgConnection.id, crypto.randomUUID())).rejects.toThrow(
        'auth failed'
      )
      expect(manager.list()).toEqual([])
    })

    it('closes an organization session whose connection the user lost', async () => {
      const { manager } = setup()
      let visible = true
      const states: Array<{ state: string; errorMessage: string | null }> = []
      manager.setEvents({ onStateChanged: (d) => states.push(d) } as never)
      const source = {
        ...orgSource().source,
        scope: 'acme',
        connection: async (id: string) =>
          visible && id === orgConnection.id ? { ...orgConnection } : null
      }
      manager.setConnectionSource(() => source)
      await manager.open(orgConnection.id, crypto.randomUUID())
      expect(await manager.revalidate('acme')).toBe(0)
      expect(manager.list()).toHaveLength(1)
      visible = false
      expect(await manager.revalidate('acme')).toBe(1)
      expect(manager.list()).toEqual([])
      expect(states).toContainEqual(
        expect.objectContaining({
          state: 'error',
          errorMessage: 'Seu acesso a esta conexão foi removido.'
        })
      )
    })

    it('revoking an organization closes only its sessions', async () => {
      const { manager, repos } = setup()
      manager.setConnectionSource(() => ({ ...orgSource().source, scope: 'acme' }))
      await manager.open(orgConnection.id, crypto.randomUUID())
      manager.setConnectionSource(null)
      await manager.open(seedConnection(repos), crypto.randomUUID())
      await manager.closeScope('acme', 'Sua sessão nesta organização foi encerrada.')
      expect(manager.list().map((d) => d.title)).toEqual(['ssh-box'])
    })

    it('clearing the source goes back to the local inventory', async () => {
      const { manager, repos } = setup()
      manager.setConnectionSource(() => orgSource().source)
      manager.setConnectionSource(null)
      const { descriptor } = await manager.open(seedConnection(repos), crypto.randomUUID())
      expect(descriptor.title).toBe('ssh-box')
    })
  })

  it('opens a session, lists it, and closes with history', async () => {
    const { manager, repos } = setup()
    const connectionId = seedConnection(repos)

    const { descriptor } = await manager.open(connectionId, crypto.randomUUID())
    expect(descriptor.state).toBe('connected')
    expect(manager.list()).toHaveLength(1)

    await manager.close(descriptor.id)
    expect(manager.list()).toHaveLength(0)

    const history = repos.history.list({ connectionId })
    expect(history).toHaveLength(1)
    expect(history[0]?.success).toBe(true)
    expect(history[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('records failed open in history', async () => {
    const { manager, driver, repos } = setup()
    driver.fail = true
    const connectionId = seedConnection(repos)

    await expect(manager.open(connectionId, crypto.randomUUID())).rejects.toThrow(/auth failed/)
    expect(manager.list()).toHaveLength(0)

    const history = repos.history.list({ connectionId })
    expect(history[0]?.success).toBe(false)
    expect(history[0]?.errorMessage).toMatch(/auth failed/)
  })

  it('upserts known_hosts when host key is accepted', () => {
    const { manager, repos } = setup()
    const requestId = crypto.randomUUID()
    let accepted: boolean | null = null

    const pending = (
      manager as unknown as {
        pendingHostKeys: Map<
          string,
          {
            resolve: (v: boolean) => void
            host: string
            port: number
            keyType: string
            fingerprint: string
            hostKey: Buffer
          }
        >
      }
    ).pendingHostKeys

    pending.set(requestId, {
      resolve: (v) => {
        accepted = v
      },
      host: 'example.test',
      port: 22,
      keyType: 'ssh-ed25519',
      fingerprint: 'SHA256:abc',
      hostKey: Buffer.from('key')
    })

    manager.respondHostKey({ requestId, accept: true })
    expect(accepted).toBe(true)
    expect(repos.knownHosts.get('example.test', 22, 'ssh-ed25519')?.fingerprint).toBe('SHA256:abc')
  })

  it('rejects host key without persisting known_hosts', () => {
    const { manager, repos } = setup()
    const requestId = crypto.randomUUID()
    let accepted: boolean | null = null

    const pending = (
      manager as unknown as {
        pendingHostKeys: Map<
          string,
          {
            resolve: (v: boolean) => void
            host: string
            port: number
            keyType: string
            fingerprint: string
            hostKey: Buffer
          }
        >
      }
    ).pendingHostKeys

    pending.set(requestId, {
      resolve: (v) => {
        accepted = v
      },
      host: 'reject.test',
      port: 22,
      keyType: 'ssh-ed25519',
      fingerprint: 'SHA256:rej',
      hostKey: Buffer.from('key')
    })

    manager.respondHostKey({ requestId, accept: false })
    expect(accepted).toBe(false)
    expect(repos.knownHosts.get('reject.test', 22, 'ssh-ed25519')).toBeNull()
  })

  it('opens after host key accept via prompt event', async () => {
    const { manager, driver, repos } = setup()
    driver.requireHostKey = true
    const connectionId = seedConnection(repos)

    manager.setEvents({
      onStateChanged: () => undefined,
      onHostKeyPrompt: (prompt) => {
        manager.respondHostKey({ requestId: prompt.requestId, accept: true })
      }
    })

    const { descriptor } = await manager.open(connectionId, crypto.randomUUID())
    expect(descriptor.state).toBe('connected')
    expect(driver.lastVerifyAccepted).toBe(true)
    expect(repos.knownHosts.get('127.0.0.1', 22, 'ssh-ed25519')?.fingerprint).toBe(
      'SHA256:testhost'
    )
  })

  it('fails open when host key is rejected', async () => {
    const { manager, driver, repos } = setup()
    driver.requireHostKey = true
    const connectionId = seedConnection(repos)

    manager.setEvents({
      onStateChanged: () => undefined,
      onHostKeyPrompt: (prompt) => {
        manager.respondHostKey({ requestId: prompt.requestId, accept: false })
      }
    })

    await expect(manager.open(connectionId, crypto.randomUUID())).rejects.toThrow(
      /Host key rejected/
    )
    expect(manager.list()).toHaveLength(0)
  })

  it('fails open when secret resolution rejects with a friendly message', async () => {
    const db = openDatabase(':memory:')
    dbs.push(db)
    migrate(db, migrations)
    const repos = createRepositories(db)

    const failingEncryptor = {
      isAvailable: () => true,
      encrypt: (plainText: string) => Buffer.from(plainText, 'utf8'),
      decrypt: () => {
        throw new Error('boom')
      }
    }
    const vault = new CredentialVault(repos.credentials, failingEncryptor)
    const manager = new ProtocolManager(repos, vault, () => {
      const port1 = new FakePort() as unknown as MessagePortMain
      const port2 = new FakePort() as unknown as MessagePortMain
      return { port1, port2 }
    })
    const driver = new FakeDriver()
    driver.requireSecret = true
    manager.register(driver)

    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const ref = vault.setSecret('hidden')
    const connection = repos.connections.create({
      groupId: group.id,
      name: 'ssh-box',
      protocol: 'ssh',
      host: '127.0.0.1',
      port: 22,
      authMethod: 'password',
      credentialRef: ref
    })

    await expect(manager.open(connection.id, crypto.randomUUID())).rejects.toThrow(
      /Não foi possível ler a senha salva/
    )
    expect(manager.list()).toHaveLength(0)

    const history = repos.history.list({ connectionId: connection.id })
    expect(history[0]?.success).toBe(false)
    expect(history[0]?.errorMessage).toMatch(/Não foi possível ler a senha salva/)
  })

  it('opens a database session from an Access and records access history', async () => {
    const { manager, repos } = setup()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const access = repos.accesses.create({
      groupId: group.id,
      type: 'database',
      name: 'local-sqlite',
      engine: 'sqlite',
      host: ':memory:',
      port: null,
      database: null,
      ssl: false
    })

    const { descriptor } = await manager.openAccess(access.id)
    expect(descriptor.kind).toBe('database')
    expect(descriptor.accessId).toBe(access.id)
    expect(descriptor.connectionId).toBeNull()
    expect(descriptor.state).toBe('connected')
    expect(manager.getActiveSession(descriptor.id)?.database).toBeTruthy()

    await manager.close(descriptor.id)
    const history = repos.history.list({ accessId: access.id })
    expect(history).toHaveLength(1)
    expect(history[0]?.success).toBe(true)
    expect(history[0]?.connectionId).toBeNull()
  })

  it('rejects Access engines that are inventory-only', async () => {
    const { manager, repos } = setup()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const access = repos.accesses.create({
      groupId: group.id,
      type: 'database',
      name: 'redis-cache',
      engine: 'redis',
      host: '127.0.0.1',
      port: 6379
    })

    await expect(manager.openAccess(access.id)).rejects.toThrow(/não abre sessão SQL/)
  })

  it('opens an API session from an Access and records access history', async () => {
    const { manager, repos } = setup()
    const client = repos.clients.create({ name: 'C' })
    const env = repos.environments.create({ clientId: client.id, name: 'E' })
    const group = repos.groups.create({ environmentId: env.id, name: 'G' })
    const access = repos.accesses.create({
      groupId: group.id,
      type: 'api',
      name: 'Petstore',
      url: 'https://api.example.com'
    })

    const { descriptor } = await manager.openAccess(access.id)
    expect(descriptor.kind).toBe('api')
    expect(descriptor.protocol).toBe('api')
    expect(descriptor.accessId).toBe(access.id)
    expect(descriptor.state).toBe('connected')
    expect(manager.getActiveSession(descriptor.id)?.api).toBeTruthy()

    await manager.close(descriptor.id)
    const history = repos.history.list({ accessId: access.id })
    expect(history).toHaveLength(1)
    expect(history[0]?.success).toBe(true)
  })
})
