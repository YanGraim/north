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

  it('records tracking data when the repo commit changes during a run', async () => {
    const gitResponses: Record<string, { exitCode: number; stdout: string }> = {
      'rev-parse HEAD': { exitCode: 0, stdout: 'b2\n' }, // same answer before/after would be a no-op...
      'branch --show-current': { exitCode: 0, stdout: 'release\n' },
      'log --oneline': { exitCode: 0, stdout: 'b2 fix: thing\n' },
      'diff --name-only': { exitCode: 0, stdout: 'a.php\n' }
    }
    let revParseCalls = 0
    const session: RemoteExecSession = {
      exec: vi.fn(async (command: string) => {
        if (command.includes('rev-parse HEAD')) {
          revParseCalls++
          // first call (before) -> a1, second call (after) -> b2
          return { exitCode: 0, stdout: revParseCalls === 1 ? 'a1\n' : 'b2\n', stderr: '' }
        }
        for (const [match, result] of Object.entries(gitResponses)) {
          if (command.includes(match)) return { ...result, stderr: '' }
        }
        return { exitCode: 0, stdout: '', stderr: '' }
      }),
      dispose: vi.fn(async () => undefined)
    }

    const onTrackingComplete = vi.fn()
    const engine = new WorkflowEngine({
      onEvent: () => undefined,
      openExecSession: async () => session,
      persistStatus: () => undefined,
      onTrackingComplete
    })

    const status = await engine.run({
      runId: 'run-tracking',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Pull',
            policy: { onFailure: 'stop' },
            config: { command: 'git pull' }
          }
        ],
        tracking: { type: 'git-update', repositoryPath: '/var/www/html/wms-api' }
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(onTrackingComplete).toHaveBeenCalledOnce()
    const payload = onTrackingComplete.mock.calls[0]?.[0]
    expect(payload.before).toEqual({ commit: 'a1', branch: 'release' })
    expect(payload.currentCommit).toBe('b2')
    expect(payload.commits).toEqual([{ hash: 'b2', message: 'fix: thing' }])
    expect(payload.filesChanged).toBe(1)
    expect(payload.status).toBe('success')
  })

  it('never calls onTrackingComplete or fails the run when git tracking errors', async () => {
    const session: RemoteExecSession = {
      exec: vi.fn(async (command: string) => {
        if (command.includes("-C '")) {
          throw new Error('ssh channel closed')
        }
        return { exitCode: 0, stdout: '', stderr: '' }
      }),
      dispose: vi.fn(async () => undefined)
    }

    const onTrackingComplete = vi.fn()
    const events: string[] = []
    const engine = new WorkflowEngine({
      onEvent: (e) => events.push(e.type),
      openExecSession: async () => session,
      persistStatus: () => undefined,
      onTrackingComplete
    })

    const status = await engine.run({
      runId: 'run-tracking-fail',
      mode: 'live',
      definition: {
        schemaVersion: 1,
        inputs: [],
        steps: [
          {
            id: 's1',
            type: 'ssh.exec',
            name: 'Pull',
            policy: { onFailure: 'stop' },
            config: { command: 'git pull' }
          }
        ],
        tracking: { type: 'git-update', repositoryPath: '/does/not/exist' }
      },
      groupVariables: {},
      inputValues: {}
    })

    expect(status).toBe('succeeded')
    expect(events.at(-1)).toBe('run_finished')
    expect(onTrackingComplete).not.toHaveBeenCalled()
  })
})
