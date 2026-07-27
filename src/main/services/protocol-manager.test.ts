import { EventEmitter } from 'node:events'
import type {
  ConnectOptions,
  ProtocolDriver,
  ProtocolSession,
  SessionDataPort,
  SessionState
} from '@shared/protocols'
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
})
