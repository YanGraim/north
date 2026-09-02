import { buildRunVariables, type InterpolateContext } from '@shared/lib/interpolate'
import type {
  RunMode,
  RunStatus,
  StepRunStatus,
  WorkflowDefinition,
  WorkflowRunEvent,
  WorkflowStep
} from '@shared/types'
import type { RemoteExecSession } from './remote-exec-service'
import { defaultStepRegistry, type StepTypeRegistry } from './step-registry'

export type WorkflowEngineDeps = {
  registry?: StepTypeRegistry
  onEvent: (event: WorkflowRunEvent) => void
  openExecSession: () => Promise<RemoteExecSession>
  persistStatus: (status: RunStatus, finishedAt: string | null) => void
  /** Resolve a connection_secrets kind from the vault; null = miss. */
  resolveConnectionSecret?: (kind: string) => Promise<string | null>
}

export type StartEngineOpts = {
  runId: string
  mode: RunMode
  definition: WorkflowDefinition
  groupVariables: Record<string, string>
  inputValues: Record<string, string | boolean>
}

type PauseKind = 'confirm' | 'auth' | 'on_failure_ask'

type PauseGate = {
  kind: PauseKind
  stepId: string
  resolve: (action: PauseResponse) => void
}

export type PauseResponse =
  | { action: 'confirm' }
  | { action: 'retry' }
  | { action: 'continue' }
  | { action: 'cancel' }
  | {
      action: 'provide_secret'
      secret: string
      username?: string
      secretKind?: string
      learnToSave?: boolean
    }

/**
 * Linear workflow engine: resolve → execute/preview per step.
 * Supports pause for confirm / onFailure ask / auth prompt.
 */
export class WorkflowEngine {
  private readonly registry: StepTypeRegistry
  private readonly onEvent: WorkflowEngineDeps['onEvent']
  private readonly openExecSession: WorkflowEngineDeps['openExecSession']
  private readonly persistStatus: WorkflowEngineDeps['persistStatus']
  private readonly resolveConnectionSecret: (kind: string) => Promise<string | null>

  private cancelled = false
  private pauseGate: PauseGate | null = null
  private variables: InterpolateContext = {}

  constructor(deps: WorkflowEngineDeps) {
    this.registry = deps.registry ?? defaultStepRegistry
    this.onEvent = deps.onEvent
    this.openExecSession = deps.openExecSession
    this.persistStatus = deps.persistStatus
    this.resolveConnectionSecret = deps.resolveConnectionSecret ?? (async () => null)
  }

  respond(response: PauseResponse): void {
    if (!this.pauseGate) return
    const gate = this.pauseGate
    this.pauseGate = null
    gate.resolve(response)
  }

  cancel(): void {
    this.cancelled = true
    if (this.pauseGate) {
      const gate = this.pauseGate
      this.pauseGate = null
      gate.resolve({ action: 'cancel' })
    }
  }

  async run(opts: StartEngineOpts): Promise<RunStatus> {
    const startedAt = Date.now()
    const steps = opts.definition.steps
    const inputDefaults: Record<string, string> = {}
    for (const input of opts.definition.inputs) {
      if (input.default !== undefined) {
        inputDefaults[input.key] =
          typeof input.default === 'boolean'
            ? input.default
              ? 'true'
              : 'false'
            : String(input.default)
      }
    }

    this.variables = buildRunVariables({
      groupVariables: opts.groupVariables,
      inputDefaults,
      inputValues: opts.inputValues
    })

    this.persistStatus('running', null)
    this.onEvent({
      type: 'run_started',
      runId: opts.runId,
      totalSteps: steps.length,
      mode: opts.mode
    })

    let session: RemoteExecSession | null = null
    let completedSteps = 0
    let finalStatus: RunStatus = 'succeeded'

    try {
      if (opts.mode === 'live' && steps.some((s) => needsRemoteExec(s))) {
        session = await this.openExecSession()
      }

      for (let index = 0; index < steps.length; index++) {
        if (this.cancelled) {
          finalStatus = 'cancelled'
          break
        }

        const step = steps[index]
        if (!step) continue

        this.onEvent({
          type: 'run_progress',
          completedSteps,
          totalSteps: steps.length,
          currentStepId: step.id
        })
        this.onEvent({ type: 'step_started', stepId: step.id, index })

        const stepStarted = Date.now()
        let stepStatus: StepRunStatus = 'succeeded'
        let exitCode: number | undefined

        try {
          const result = await this.runStep(step, opts.mode, session)
          stepStatus = result.status
          exitCode = result.exitCode
        } catch (error) {
          stepStatus = 'failed'
          this.onEvent({
            type: 'step_log',
            stepId: step.id,
            stream: 'system',
            chunk: error instanceof Error ? error.message : String(error)
          })
        }

        const durationMs = Date.now() - stepStarted
        this.onEvent({
          type: 'step_finished',
          stepId: step.id,
          status: stepStatus,
          durationMs,
          exitCode
        })

        const failed = stepStatus === 'failed' || (stepStatus === 'cancelled' && this.cancelled)

        if (failed && !this.cancelled) {
          const onFailure = step.policy?.onFailure ?? 'stop'
          if (onFailure === 'continue') {
            completedSteps++
            continue
          }
          if (onFailure === 'ask') {
            const response = await this.waitPause('on_failure_ask', step.id)
            if (response.action === 'retry') {
              index--
              continue
            }
            if (response.action === 'continue') {
              completedSteps++
              continue
            }
            finalStatus = 'cancelled'
            break
          }
          finalStatus = 'failed'
          break
        }

        if (this.cancelled) {
          finalStatus = 'cancelled'
          break
        }

        completedSteps++
      }

      this.onEvent({
        type: 'run_progress',
        completedSteps,
        totalSteps: steps.length,
        currentStepId: null
      })
    } finally {
      await session?.dispose()
    }

    const durationMs = Date.now() - startedAt
    this.persistStatus(finalStatus, new Date().toISOString())
    this.onEvent({ type: 'run_finished', status: finalStatus, durationMs })
    return finalStatus
  }

  private async runStep(
    step: WorkflowStep,
    mode: RunMode,
    session: RemoteExecSession | null
  ): Promise<{ status: StepRunStatus; exitCode?: number }> {
    if (step.policy?.requiresConfirmation && mode === 'live') {
      const response = await this.waitPause('confirm', step.id)
      if (response.action === 'cancel') {
        this.cancelled = true
        return { status: 'cancelled' }
      }
    }

    const resolved = this.registry.resolve(step, this.variables)

    const result = await this.registry.execute(resolved, {
      mode,
      variables: this.variables,
      exec: async (command, execOpts) => {
        if (!session) {
          throw new Error('Remote exec session not open')
        }
        return session.exec(command, execOpts)
      },
      setVariable: (key, value) => {
        this.variables[key] = value
      },
      requestConfirm: async (message) => {
        this.onEvent({
          type: 'step_log',
          stepId: step.id,
          stream: 'system',
          chunk: message
        })
        const response = await this.waitPause('confirm', step.id)
        return response.action === 'confirm'
      },
      requestAuth: async (request) => {
        this.onEvent({
          type: 'auth_prompt',
          stepId: step.id,
          kind: request.kind,
          message: request.message,
          canLearn: true,
          needsUsername: request.needsUsername
        })
        const response = await this.waitPause('auth', step.id)
        if (response.action === 'provide_secret') {
          return { secret: response.secret, username: response.username }
        }
        return null
      },
      resolveConnectionSecret: (kind) => this.resolveConnectionSecret(kind),
      emitLog: (stream, chunk) => {
        this.onEvent({ type: 'step_log', stepId: step.id, stream, chunk })
      }
    })

    return {
      status: result.status,
      exitCode: result.exitCode
    }
  }

  private waitPause(kind: PauseKind, stepId: string): Promise<PauseResponse> {
    this.persistStatus('paused', null)
    this.onEvent({ type: 'run_paused', reason: kind, stepId })
    return new Promise((resolve) => {
      this.pauseGate = { kind, stepId, resolve }
    }).then((response) => {
      this.persistStatus('running', null)
      return response as PauseResponse
    })
  }
}

function needsRemoteExec(step: WorkflowStep): boolean {
  return step.type === 'ssh.exec' || step.type === 'script'
}
