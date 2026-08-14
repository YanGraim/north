import type { WorkflowStep } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import { defaultStepRegistry } from './step-registry'

function execCtx(overrides?: Partial<Parameters<typeof defaultStepRegistry.execute>[1]>) {
  return {
    mode: 'live' as const,
    variables: {},
    exec: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    setVariable: () => undefined,
    requestConfirm: async () => true,
    requestAuth: vi.fn(async () => null),
    resolveConnectionSecret: vi.fn(async () => null),
    emitLog: () => undefined,
    ...overrides
  }
}

describe('StepPolicy / step registry', () => {
  it('resolves ssh.exec with interpolation and planned action', () => {
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Deploy',
      policy: { onFailure: 'stop', timeoutMs: 5000 },
      config: { command: 'ls {{DIR}}', cwd: '{{ROOT}}' }
    }
    const resolved = defaultStepRegistry.resolve(step, { DIR: 'app', ROOT: '/var/www' })
    expect(resolved.plannedAction).toBe('cd /var/www && ls app')
    expect(resolved.policy.timeoutMs).toBe(5000)
  })

  it('dry-run ssh.exec skips exec and logs planned command', async () => {
    const logs: string[] = []
    const exec = vi.fn()
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Echo',
      policy: { onFailure: 'stop' },
      config: { command: 'echo hi' }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    const result = await defaultStepRegistry.execute(
      resolved,
      execCtx({
        mode: 'dry-run',
        exec,
        emitLog: (_stream, chunk) => logs.push(chunk)
      })
    )
    expect(result.status).toBe('skipped_dry_run')
    expect(exec).not.toHaveBeenCalled()
    expect(logs[0]).toContain('planned:')
  })

  it('set.variable mutates run context', async () => {
    const vars: Record<string, string> = {}
    const step: WorkflowStep = {
      id: '1',
      type: 'set.variable',
      name: 'Set',
      policy: { onFailure: 'stop' },
      config: { key: 'OUT', value: '42' }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(
      resolved,
      execCtx({
        variables: vars,
        setVariable: (k, v) => {
          vars[k] = v
        }
      })
    )
    expect(vars.OUT).toBe('42')
  })

  it('ssh.exec without authHints runs raw command and never requests auth', async () => {
    const ctx = execCtx()
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Echo',
      policy: { onFailure: 'stop' },
      config: { command: 'echo hi' }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(resolved, ctx)
    expect(ctx.requestAuth).not.toHaveBeenCalled()
    expect(ctx.resolveConnectionSecret).not.toHaveBeenCalled()
    expect(ctx.exec).toHaveBeenCalledWith('echo hi', expect.any(Object))
  })

  it('ssh.exec with sudo hint uses vault secret and wraps without prompting', async () => {
    const ctx = execCtx({
      resolveConnectionSecret: vi.fn(async (kind) => (kind === 'sudo' ? 'vault-sudo' : null))
    })
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Restart',
      policy: { onFailure: 'stop' },
      config: { command: 'systemctl restart app', authHints: ['sudo'] }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(resolved, ctx)
    expect(ctx.requestAuth).not.toHaveBeenCalled()
    const executed = (ctx.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('sudo -S')
    expect(executed).toContain('vault-sudo')
    expect(resolved.plannedAction).toBe('systemctl restart app')
  })

  it('ssh.exec with sudo hint and vault miss prompts then wraps', async () => {
    const ctx = execCtx({
      requestAuth: vi.fn(async () => ({ secret: 'typed-sudo' }))
    })
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Restart',
      policy: { onFailure: 'stop' },
      config: { command: 'true', authHints: ['sudo'] }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(resolved, ctx)
    expect(ctx.requestAuth).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'sudo', needsUsername: false })
    )
    const executed = (ctx.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('typed-sudo')
    expect(executed).not.toBe('true')
  })

  it('ssh.exec with git hint prompts for username+password when vault misses', async () => {
    const ctx = execCtx({
      requestAuth: vi.fn(async () => ({ secret: 'gp', username: 'alice' }))
    })
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Pull',
      policy: { onFailure: 'stop' },
      config: { command: 'git pull', authHints: ['git'] }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(resolved, ctx)
    expect(ctx.requestAuth).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'git', needsUsername: true })
    )
    const executed = (ctx.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('ASKPASS=$(mktemp)')
    expect(executed).toContain('GIT_ASKPASS=')
    expect(executed).toContain('bitbucket.org')
  })

  it('maps legacy authHint to authHints behavior', async () => {
    const ctx = execCtx({
      resolveConnectionSecret: vi.fn(async (kind) => (kind === 'sudo' ? 'leg' : null))
    })
    const step: WorkflowStep = {
      id: '1',
      type: 'ssh.exec',
      name: 'Legacy',
      policy: { onFailure: 'stop' },
      config: { command: 'id', authHint: 'sudo' }
    }
    const resolved = defaultStepRegistry.resolve(step, {})
    await defaultStepRegistry.execute(resolved, ctx)
    expect(ctx.resolveConnectionSecret).toHaveBeenCalledWith('sudo')
    const executed = (ctx.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('sudo -S')
  })
})
