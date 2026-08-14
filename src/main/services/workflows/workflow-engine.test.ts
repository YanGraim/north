import type { WorkflowDefinition } from '@shared/types'
import { describe, expect, it, vi } from 'vitest'
import type { RemoteExecSession } from './remote-exec-service'
import { WorkflowEngine } from './workflow-engine'

function definition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    schemaVersion: 1,
    inputs: [],
    steps: [
      {
        id: 's1',
        type: 'ssh.exec',
        name: 'One',
        policy: { onFailure: 'stop' },
        config: { command: 'echo {{MSG}}' }
      },
      {
        id: 's2',
        type: 'ssh.exec',
        name: 'Two',
        policy: { onFailure: 'ask' },
        config: { command: 'false' }
      }
    ],
    ...overrides
  }
}

function mockSession(results: Array<{ exitCode: number }> = []): RemoteExecSession {
  let i = 0
  return {
    exec: vi.fn(async () => {
      const result = results[i] ?? { exitCode: 0 }
      i++
      return { exitCode: result.exitCode, stdout: '', stderr: '' }
    }),
    dispose: vi.fn(async () => undefined)
  }
}

describe('WorkflowEngine', () => {
  it('runs steps linearly and snapshots progress events', async () => {
    const events: string[] = []
    const session = mockSession([{ exitCode: 0 }, { exitCode: 0 }])
    const statuses: string[] = []

    const engine = new WorkflowEngine({
      onEvent: (e) => events.push(e.type),
      openExecSession: async () => session,
      persistStatus: (status) => statuses.push(status)
    })

    const status = await engine.run({
      runId: 'run-1',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'One',
            policy: { onFailure: 'stop' },
            config: { command: 'echo ok' }
          },
          {
            id: 's2',
            type: 'delay',
            name: 'Wait',
            policy: { onFailure: 'stop' },
            config: { ms: 1 }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(events[0]).toBe('run_started')
    expect(events).toContain('step_started')
    expect(events).toContain('step_finished')
    expect(events.at(-1)).toBe('run_finished')
    expect(session.dispose).toHaveBeenCalledOnce()
    expect(session.exec).toHaveBeenCalledOnce()
  })

  it('dry-run does not call remote exec', async () => {
    const session = mockSession()
    const openExec = vi.fn(async () => session)
    const engine = new WorkflowEngine({
      onEvent: () => undefined,
      openExecSession: openExec,
      persistStatus: () => undefined
    })

    const status = await engine.run({
      runId: 'run-dry',
      mode: 'dry-run',
      definition: definition({
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'One',
            policy: { onFailure: 'stop' },
            config: { command: 'echo {{MSG}}' }
          }
        ]
      }),
      groupVariables: { MSG: 'hi' },
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(openExec).not.toHaveBeenCalled()
    expect(session.exec).not.toHaveBeenCalled()
  })

  it('onFailure ask supports continue', async () => {
    const session = mockSession([{ exitCode: 1 }, { exitCode: 0 }])
    const engine = new WorkflowEngine({
      onEvent: (e) => {
        if (e.type === 'run_paused' && e.reason === 'on_failure_ask') {
          queueMicrotask(() => engine.respond({ action: 'continue' }))
        }
      },
      openExecSession: async () => session,
      persistStatus: () => undefined
    })

    const status = await engine.run({
      runId: 'run-ask',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 'fail',
            type: 'ssh.exec',
            name: 'Fail',
            policy: { onFailure: 'ask' },
            config: { command: 'false' }
          },
          {
            id: 'ok',
            type: 'ssh.exec',
            name: 'Ok',
            policy: { onFailure: 'stop' },
            config: { command: 'true' }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(session.exec).toHaveBeenCalledTimes(2)
  })

  it('onFailure continue skips without pausing', async () => {
    const session = mockSession([{ exitCode: 1 }, { exitCode: 0 }])
    const paused: string[] = []
    const engine = new WorkflowEngine({
      onEvent: (e) => {
        if (e.type === 'run_paused') paused.push(e.reason)
      },
      openExecSession: async () => session,
      persistStatus: () => undefined
    })

    const status = await engine.run({
      runId: 'run-cont',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 'fail',
            type: 'ssh.exec',
            name: 'Fail',
            policy: { onFailure: 'continue' },
            config: { command: 'false' }
          },
          {
            id: 'ok',
            type: 'delay',
            name: 'Ok',
            policy: { onFailure: 'stop' },
            config: { ms: 1 }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(paused).toEqual([])
  })

  it('requiresConfirmation pauses before step', async () => {
    const session = mockSession([{ exitCode: 0 }])
    const engine = new WorkflowEngine({
      onEvent: (e) => {
        if (e.type === 'run_paused' && e.reason === 'confirm') {
          queueMicrotask(() => engine.respond({ action: 'confirm' }))
        }
      },
      openExecSession: async () => session,
      persistStatus: () => undefined
    })

    const status = await engine.run({
      runId: 'run-confirm',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Danger',
            policy: { onFailure: 'stop', requiresConfirmation: true },
            config: { command: 'rm -rf /' }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(session.exec).toHaveBeenCalledOnce()
  })

  it('without authHints never emits auth_prompt', async () => {
    const session = mockSession([{ exitCode: 0 }])
    const events: string[] = []
    const resolveSecret = vi.fn(async () => 'should-not-run')
    const engine = new WorkflowEngine({
      onEvent: (e) => events.push(e.type),
      openExecSession: async () => session,
      persistStatus: () => undefined,
      resolveConnectionSecret: resolveSecret
    })

    await engine.run({
      runId: 'run-no-auth',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Raw',
            policy: { onFailure: 'stop' },
            config: { command: 'echo ok' }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(events).not.toContain('auth_prompt')
    expect(resolveSecret).not.toHaveBeenCalled()
    expect(session.exec).toHaveBeenCalledWith('echo ok', expect.any(Object))
  })

  it('with authHints and vault miss pauses on auth_prompt then wraps', async () => {
    const session = mockSession([{ exitCode: 0 }])
    const engine = new WorkflowEngine({
      onEvent: (e) => {
        if (e.type === 'auth_prompt') {
          expect(e.kind).toBe('sudo')
          expect(e.needsUsername).toBe(false)
          queueMicrotask(() =>
            engine.respond({ action: 'provide_secret', secret: 'from-ui', secretKind: 'sudo' })
          )
        }
      },
      openExecSession: async () => session,
      persistStatus: () => undefined,
      resolveConnectionSecret: async () => null
    })

    const status = await engine.run({
      runId: 'run-auth-prompt',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Sudo',
            policy: { onFailure: 'stop' },
            config: { command: 'id', authHints: ['sudo'] }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    const executed = (session.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('from-ui')
    expect(executed).toContain('sudo -S')
  })

  it('with authHints and vault hit wraps without auth_prompt', async () => {
    const session = mockSession([{ exitCode: 0 }])
    const events: string[] = []
    const engine = new WorkflowEngine({
      onEvent: (e) => events.push(e.type),
      openExecSession: async () => session,
      persistStatus: () => undefined,
      resolveConnectionSecret: async (kind) => (kind === 'sudo' ? 'vaulted' : null)
    })

    await engine.run({
      runId: 'run-auth-vault',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Sudo',
            policy: { onFailure: 'stop' },
            config: { command: 'id', authHints: ['sudo'] }
          }
        ]
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(events).not.toContain('auth_prompt')
    const executed = (session.exec as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(executed).toContain('vaulted')
  })
})
