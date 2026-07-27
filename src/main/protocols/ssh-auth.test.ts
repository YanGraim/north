import type { ConnectOptions } from '@shared/protocols'
import type { Connection } from '@shared/types'
import type { Client, Prompt } from 'ssh2'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachKeyboardInteractivePassword, buildSshConnectConfig } from './ssh-auth'

function baseConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    groupId: '22222222-2222-2222-2222-222222222222',
    name: 'box',
    description: null,
    protocol: 'ssh',
    host: '127.0.0.1',
    port: 22,
    username: 'root',
    authMethod: 'password',
    credentialRef: null,
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
    checklist: [],
    relatedFiles: [],
    isFavorite: false,
    accessCount: 0,
    totalConnectedMs: 0,
    lastConnectedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function baseOpts(overrides: Partial<ConnectOptions> = {}): ConnectOptions {
  return {
    connection: baseConnection(),
    sessionId: '33333333-3333-3333-3333-333333333333',
    resolveSecret: vi.fn(),
    verifyHostKey: vi.fn(async () => true),
    ...overrides
  }
}

describe('buildSshConnectConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws a clear error when password auth has no credentialRef', async () => {
    await expect(buildSshConnectConfig(baseOpts())).rejects.toThrow(
      /Senha não configurada para esta conexão/
    )
  })

  it('propagates friendly decrypt errors from resolveSecret', async () => {
    const message =
      'Não foi possível ler a senha salva. Edite a conexão e defina a senha novamente.'
    const resolveSecret = vi.fn().mockRejectedValue(new Error(message))

    await expect(
      buildSshConnectConfig(
        baseOpts({
          connection: baseConnection({ credentialRef: '44444444-4444-4444-4444-444444444444' }),
          resolveSecret
        })
      )
    ).rejects.toThrow(message)

    expect(resolveSecret).toHaveBeenCalledWith('44444444-4444-4444-4444-444444444444')
  })

  it('sets password when resolveSecret succeeds', async () => {
    const resolveSecret = vi.fn().mockResolvedValue('s3cret')
    const config = await buildSshConnectConfig(
      baseOpts({
        connection: baseConnection({ credentialRef: '44444444-4444-4444-4444-444444444444' }),
        resolveSecret
      })
    )
    expect(config.password).toBe('s3cret')
    expect(config.tryKeyboard).toBe(true)
    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe(22)
  })

  it('answers keyboard-interactive prompts with the password', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    const client = {
      on(event: string, handler: (...args: unknown[]) => void) {
        handlers.set(event, handler)
        return client
      }
    } as unknown as Client

    attachKeyboardInteractivePassword(client, 's3cret')
    const finish = vi.fn()
    const prompts = [{ prompt: 'Password: ', echo: false }] as Prompt[]
    handlers.get('keyboard-interactive')?.('', '', '', prompts, finish)
    expect(finish).toHaveBeenCalledWith(['s3cret'])
  })
})
