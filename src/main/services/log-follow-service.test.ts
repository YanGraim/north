import { type Connection, LogFollowStartInputSchema } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { type LogFollowDeps, LogFollowService } from './log-follow-service'
import type { FollowClient, FollowConnector, FollowExec, HostKeyInfo } from './log-follow-ssh'

const CONN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FILE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const FILE_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

class FakeExec implements FollowExec {
  stdout: ((chunk: Uint8Array) => void) | null = null
  exit: ((code: number | null) => void) | null = null
  onStdout(listener: (chunk: Uint8Array) => void): void {
    this.stdout = listener
  }
  onStderr(): void {}
  onExit(listener: (code: number | null) => void): void {
    this.exit = listener
  }
  close(): void {}
}

class FakeClient implements FollowClient {
  command = ''
  homeAsked = false
  readonly execChannel = new FakeExec()
  constructor(private readonly home: string | null) {}
  async homeDirectory(): Promise<string | null> {
    this.homeAsked = true
    return this.home
  }
  async exec(command: string): Promise<FollowExec> {
    this.command = command
    return this.execChannel
  }
  onDisconnect(): void {}
  end(): void {}
}

function connection(logFiles: Connection['logFiles']): Connection {
  return {
    id: CONN,
    groupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    name: 'web',
    description: null,
    protocol: 'ssh',
    host: '10.0.0.8',
    port: 22,
    username: 'root',
    authMethod: 'password',
    credentialRef: null,
    privateKeyPath: null,
    agentForward: false,
    jumpHostId: null,
    defaultCommand: null,
    startupDirectory: null,
    logFiles,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function setup(options: {
  logFiles: Connection['logFiles']
  home?: string | null
  acceptHostKey?: boolean
  load?: LogFollowDeps['load']
}) {
  const client = new FakeClient(options.home ?? null)
  let opens = 0
  const connector: FollowConnector = {
    async open(opts) {
      opens += 1
      const accepted = await opts.verifyHostKey({
        host: '10.0.0.8',
        port: 22,
        keyType: 'ssh-ed25519',
        fingerprint: 'SHA256:abc',
        hostKey: new Uint8Array([1])
      } satisfies HostKeyInfo)
      if (!accepted) throw new Error('host key rejected')
      return client
    }
  }
  const chunks: Array<{ followId: string; seq: number; data: number[] }> = []
  const focusMain = vi.fn()
  const focusWindow = vi.fn()
  const deps: LogFollowDeps = {
    load:
      options.load ??
      (async () => ({
        connection: connection(options.logFiles),
        resolveSecret: async () => 'secret'
      })),
    ensureVpn: async () => undefined,
    releaseVpn: () => undefined,
    confirmHostKey: async () => options.acceptHostKey !== false,
    focusMain,
    focusWindow,
    connector,
    onChanged: () => undefined,
    onBytes: (followId, seq, bytes) => {
      chunks.push({ followId, seq, data: Array.from(bytes) })
    },
    onReset: () => undefined
  }
  return {
    service: new LogFollowService(deps),
    client,
    chunks,
    opens: () => opens,
    focusMain,
    focusWindow
  }
}

describe('LogFollowService', () => {
  it('tails an absolute path without asking SFTP for the home directory', async () => {
    const { service, client } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/my app.log', label: null }]
    })
    const started = await service.start(CONN, FILE_A)
    await service.idle()
    expect(started.ok).toBe(true)
    expect(client.homeAsked).toBe(false)
    expect(client.command).toBe("tail -n 200 -F -- '/var/log/my app.log'")
    expect(service.list()[0]?.state).toBe('live')
  })

  it('resolves ~ via the login directory and quotes the absolute path', async () => {
    const { service, client } = setup({
      home: '/home/u',
      logFiles: [{ id: FILE_A, path: '~/app/app.log', label: 'api' }]
    })
    await service.start(CONN, FILE_A)
    await service.idle()
    expect(client.homeAsked).toBe(true)
    expect(client.command).toBe("tail -n 200 -F -- '/home/u/app/app.log'")
  })

  it('reports PATH_UNRESOLVED when ~ cannot be expanded', async () => {
    const { service, client } = setup({
      home: null,
      logFiles: [{ id: FILE_A, path: '~/app/app.log', label: null }]
    })
    await service.start(CONN, FILE_A)
    await service.idle()
    expect(client.command).toBe('')
    expect(service.list()[0]?.errorCode).toBe('PATH_UNRESOLVED')
  })

  it('keeps the follow and marks TAIL_MISSING when tail exits 127', async () => {
    const { service, client } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: null }]
    })
    await service.start(CONN, FILE_A)
    await service.idle()
    client.execChannel.exit?.(127)
    expect(service.list()).toHaveLength(1)
    expect(service.list()[0]?.errorCode).toBe('TAIL_MISSING')
  })

  it('focuses an open follow instead of opening a second SSH client', async () => {
    const { service, opens, focusMain } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: null }]
    })
    await service.start(CONN, FILE_A)
    const again = await service.start(CONN, FILE_A)
    expect(again.ok && again.alreadyOpen).toBe(true)
    expect(opens()).toBe(1)
    expect(focusMain).toHaveBeenCalled()
    expect(service.list()[0]?.focusNonce).toBe(1)
  })

  it('refuses the ninth follow', async () => {
    const logFiles = Array.from({ length: 8 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      path: `/var/log/app-${index}.log`,
      label: null
    }))
    const { service } = setup({ logFiles })
    for (const file of logFiles) {
      const started = await service.start(CONN, file.id)
      expect(started.ok).toBe(true)
    }
    expect(await service.start(CONN, FILE_B)).toEqual({ ok: false, code: 'LIMIT' })
  })

  it('publishes each chunk and replays the ring', async () => {
    const { service, client, chunks } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: null }]
    })
    const started = await service.start(CONN, FILE_A)
    await service.idle()
    if (!started.ok) throw new Error('start failed')
    client.execChannel.stdout?.(Uint8Array.from([65, 10]))
    expect(chunks).toEqual([{ followId: started.snapshot.id, seq: 1, data: [65, 10] }])
    expect(service.replay(started.snapshot.id)).toEqual({ seq: 1, data: [65, 10] })
  })

  it('rejects an invalid path without creating a follow', async () => {
    const { service, opens } = setup({ logFiles: [] })
    for (const path of ['var/log', '~other/app.log', '/tmp/a\nb', "'/var/log/app.log'", '  ']) {
      expect(await service.startPath(CONN, path)).toEqual({ ok: false, code: 'INVALID_PATH' })
    }
    expect(service.list()).toHaveLength(0)
    expect(opens()).toBe(0)
  })

  it('does not count an ephemeral follow toward the saved limit', async () => {
    const logFiles = Array.from({ length: 8 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      path: `/var/log/app-${index}.log`,
      label: null
    }))
    logFiles.push({ id: FILE_B, path: '/var/log/ninth.log', label: null })
    const { service } = setup({ logFiles })
    for (const file of logFiles.slice(0, 8)) {
      const started = await service.start(CONN, file.id)
      expect(started.ok).toBe(true)
    }
    const ephemeral = await service.startPath(CONN, '/tmp/selection.log')
    expect(ephemeral.ok).toBe(true)
    if (!ephemeral.ok) throw new Error('path start failed')
    expect(ephemeral.alreadyOpen).toBe(false)
    expect(ephemeral.snapshot).toMatchObject({
      ephemeral: true,
      logFileId: null,
      label: null,
      path: '/tmp/selection.log',
      placement: 'dock'
    })
    expect(service.list()).toHaveLength(9)
    expect(await service.start(CONN, FILE_B)).toEqual({ ok: false, code: 'LIMIT' })
    expect(service.list()).toHaveLength(9)
  })

  it('focuses an already-open follow of the same normalized path', async () => {
    const { service, opens, focusMain, focusWindow } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: 'api' }]
    })
    const saved = await service.start(CONN, FILE_A)
    if (!saved.ok) throw new Error('start failed')
    const byPath = await service.startPath(CONN, ' /var/log/app.log/ ')
    expect(byPath.ok && byPath.alreadyOpen).toBe(true)
    expect(opens()).toBe(1)
    expect(focusMain).toHaveBeenCalled()
    expect(service.list()).toHaveLength(1)
    expect(service.list()[0]?.ephemeral).toBe(false)
    expect(service.list()[0]?.focusNonce).toBe(1)

    service.setPlacement(saved.snapshot.id, 'window')
    const fromWindow = await service.start(CONN, FILE_A)
    expect(fromWindow.ok && fromWindow.alreadyOpen).toBe(true)
    expect(focusWindow).toHaveBeenCalledWith(saved.snapshot.id)
    expect(opens()).toBe(1)

    const selection = await service.startPath(CONN, '/var/log/other.log')
    if (!selection.ok) throw new Error('path start failed')
    const selectionAgain = await service.startPath(CONN, '/var/log/other.log')
    expect(selectionAgain.ok && selectionAgain.alreadyOpen).toBe(true)
    expect(opens()).toBe(2)

    const savedOfSelection = await service.startPath(CONN, '~/app.log')
    expect(savedOfSelection.ok && savedOfSelection.alreadyOpen).toBe(false)
    const absolute = await service.startPath(CONN, '/home/u/app.log')
    expect(absolute.ok && absolute.alreadyOpen).toBe(false)
    expect(service.list()).toHaveLength(4)
  })

  it('focuses a selection follow when start uses the same normalized path', async () => {
    const { service, opens, focusMain } = setup({
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: 'api' }]
    })
    const ephemeral = await service.startPath(CONN, '/var/log/app.log')
    if (!ephemeral.ok) throw new Error('path start failed')
    expect(ephemeral.snapshot).toMatchObject({
      ephemeral: true,
      logFileId: null,
      label: null,
      path: '/var/log/app.log'
    })
    const again = await service.start(CONN, FILE_A)
    expect(again.ok && again.alreadyOpen).toBe(true)
    expect(opens()).toBe(1)
    expect(focusMain).toHaveBeenCalled()
    expect(service.list()).toHaveLength(1)
    expect(service.list()[0]?.ephemeral).toBe(true)
    expect(service.list()[0]?.logFileId).toBeNull()
  })

  it('retries an ephemeral follow without a logFiles row', async () => {
    let current: Connection | null = connection([])
    const { service, client, opens } = setup({
      logFiles: [],
      home: '/home/u',
      load: async () =>
        current ? { connection: current, resolveSecret: async () => 'secret' } : null
    })
    const started = await service.startPath(CONN, '~/app.log')
    await service.idle()
    if (!started.ok) throw new Error('start failed')
    expect(client.command).toBe("tail -n 200 -F -- '/home/u/app.log'")
    expect(service.list()[0]).toMatchObject({
      ephemeral: true,
      logFileId: null,
      label: null,
      path: '~/app.log',
      connectionName: 'web'
    })

    current = { ...connection([]), name: 'renamed' }
    const retried = service.retry(started.snapshot.id)
    expect(retried?.path).toBe('~/app.log')
    expect(retried?.label).toBeNull()
    await service.idle()
    expect(service.list()[0]).toMatchObject({
      state: 'live',
      errorCode: null,
      path: '~/app.log',
      label: null,
      connectionName: 'renamed',
      ephemeral: true,
      logFileId: null
    })
    expect(opens()).toBe(2)
    expect(client.command).toBe("tail -n 200 -F -- '/home/u/app.log'")

    current = { ...connection([]), protocol: 'telnet' }
    service.retry(started.snapshot.id)
    await service.idle()
    expect(service.list()[0]?.errorCode).toBe('NOT_SSH')
    expect(service.list()[0]?.path).toBe('~/app.log')

    current = null
    service.retry(started.snapshot.id)
    await service.idle()
    expect(service.list()[0]?.errorCode).toBe('NOT_FOUND')
    expect(service.list()).toHaveLength(1)
  })

  it('rejects a start input that carries both logFileId and path', () => {
    expect(
      LogFollowStartInputSchema.safeParse({ connectionId: CONN, logFileId: FILE_A }).success
    ).toBe(true)
    expect(
      LogFollowStartInputSchema.safeParse({ connectionId: CONN, path: '/var/log/app.log' }).success
    ).toBe(true)
    expect(
      LogFollowStartInputSchema.safeParse({
        connectionId: CONN,
        logFileId: FILE_A,
        path: '/var/log/app.log'
      }).success
    ).toBe(false)
    expect(LogFollowStartInputSchema.safeParse({ connectionId: CONN }).success).toBe(false)
  })

  it('fails with HOST_KEY_REJECTED and does not exec', async () => {
    const { service, client, focusMain } = setup({
      acceptHostKey: false,
      logFiles: [{ id: FILE_A, path: '/var/log/app.log', label: null }]
    })
    await service.start(CONN, FILE_A)
    await service.idle()
    expect(focusMain).toHaveBeenCalled()
    expect(client.command).toBe('')
    expect(service.list()[0]?.errorCode).toBe('HOST_KEY_REJECTED')
  })
})
