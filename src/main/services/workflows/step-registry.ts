import { type InterpolateContext, interpolateDeep } from '@shared/lib/interpolate'
import {
  parseAuthHints,
  type StepPolicy,
  WORKFLOW_SECRET_KINDS,
  type WorkflowStep
} from '@shared/types'
import { type AuthCredentials, wrapCommandForAuth } from './auth-wrap'

export type ResolvedStep = {
  step: WorkflowStep
  resolvedConfig: unknown
  policy: StepPolicy
  plannedAction: string
}

export type StepExecuteResult = {
  status: 'succeeded' | 'failed' | 'skipped' | 'skipped_dry_run'
  exitCode?: number
  logs?: Array<{ stream: 'stdout' | 'stderr' | 'system'; chunk: string }>
}

export type AuthPromptRequest = {
  kind: string
  message: string
  needsUsername?: boolean
}

export type AuthPromptResult = {
  secret: string
  username?: string
}

export type StepExecutionContext = {
  mode: 'live' | 'dry-run'
  variables: InterpolateContext
  exec: (
    command: string,
    opts?: { timeoutMs?: number; onStdout?: (c: string) => void; onStderr?: (c: string) => void }
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  setVariable: (key: string, value: string) => void
  requestConfirm: (message: string) => Promise<boolean>
  requestAuth: (request: AuthPromptRequest) => Promise<AuthPromptResult | null>
  resolveConnectionSecret: (kind: string) => Promise<string | null>
  emitLog: (stream: 'stdout' | 'stderr' | 'system', chunk: string) => void
}

export type StepTypeHandler = {
  type: string
  resolve: (step: WorkflowStep, ctx: InterpolateContext) => ResolvedStep
  execute: (resolved: ResolvedStep, ctx: StepExecutionContext) => Promise<StepExecuteResult>
}

function defaultPolicy(step: WorkflowStep): StepPolicy {
  return {
    onFailure: step.policy?.onFailure ?? 'stop',
    timeoutMs: step.policy?.timeoutMs,
    requiresConfirmation: step.policy?.requiresConfirmation ?? false,
    retryPolicy: step.policy?.retryPolicy
  }
}

function asRecord(config: unknown): Record<string, unknown> {
  return config !== null && typeof config === 'object' ? (config as Record<string, unknown>) : {}
}

async function resolveAuthCredentials(
  hints: ReturnType<typeof parseAuthHints>,
  ctx: StepExecutionContext
): Promise<AuthCredentials | null> {
  const creds: AuthCredentials = {}

  if (hints.includes('sudo')) {
    let sudo = await ctx.resolveConnectionSecret(WORKFLOW_SECRET_KINDS.sudo)
    if (!sudo) {
      const prompted = await ctx.requestAuth({
        kind: WORKFLOW_SECRET_KINDS.sudo,
        message: 'Senha sudo necessária para este step',
        needsUsername: false
      })
      if (!prompted) return null
      sudo = prompted.secret
    }
    creds.sudo = sudo
  }

  if (hints.includes('git')) {
    let username = await ctx.resolveConnectionSecret(WORKFLOW_SECRET_KINDS.gitUsername)
    let password = await ctx.resolveConnectionSecret(WORKFLOW_SECRET_KINDS.git)
    if (!password || !username) {
      const prompted = await ctx.requestAuth({
        kind: WORKFLOW_SECRET_KINDS.git,
        message: 'Credenciais Git necessárias para este step',
        needsUsername: true
      })
      if (!prompted) return null
      password = prompted.secret
      if (prompted.username) {
        username = prompted.username
      }
    }
    if (!password) return null
    creds.gitUsername = username ?? ''
    creds.gitPassword = password
  }

  return creds
}

const sshExecHandler: StepTypeHandler = {
  type: 'ssh.exec',
  resolve(step, ctx) {
    const resolvedConfig = interpolateDeep(step.config, ctx)
    const cfg = asRecord(resolvedConfig)
    const command = String(cfg.command ?? '')
    const cwd = cfg.cwd ? String(cfg.cwd) : undefined
    const planned = cwd ? `cd ${cwd} && ${command}` : command
    return { step, resolvedConfig, policy: defaultPolicy(step), plannedAction: planned }
  },
  async execute(resolved, ctx) {
    // plannedAction never includes secrets — safe to log as-is.
    if (ctx.mode === 'dry-run') {
      ctx.emitLog('system', `planned: ${resolved.plannedAction}`)
      return { status: 'skipped_dry_run' }
    }

    const hints = parseAuthHints(resolved.resolvedConfig)
    let commandToRun = resolved.plannedAction
    const looksLikeGit = /\bgit\b/.test(resolved.plannedAction)

    if (hints.length > 0) {
      const creds = await resolveAuthCredentials(hints, ctx)
      if (!creds) {
        ctx.emitLog('system', 'auth cancelled or missing credentials')
        ctx.emitLog('stderr', '[north] auth cancelled or missing credentials\n')
        return { status: 'failed' }
      }
      commandToRun = wrapCommandForAuth(resolved.plannedAction, hints, creds)
      ctx.emitLog(
        'system',
        `planned: ${resolved.plannedAction} (auth: ${hints.join('+')}; wrap=askpass+insteadOf)`
      )
      ctx.emitLog('stderr', `[north] auth=${hints.join('+')} wrap=askpass+insteadOf\n`)
    } else {
      ctx.emitLog('system', `planned: ${resolved.plannedAction} (auth: none)`)
      if (looksLikeGit) {
        ctx.emitLog(
          'stderr',
          '[north] auth=none — marque Git em Credenciais, clique Salvar, e rode de novo\n'
        )
      } else {
        ctx.emitLog('stderr', '[north] auth=none\n')
      }
    }

    const result = await ctx.exec(commandToRun, {
      timeoutMs: resolved.policy.timeoutMs,
      onStdout: (c) => ctx.emitLog('stdout', c),
      onStderr: (c) => ctx.emitLog('stderr', c)
    })
    return {
      status: result.exitCode === 0 ? 'succeeded' : 'failed',
      exitCode: result.exitCode
    }
  }
}

const delayHandler: StepTypeHandler = {
  type: 'delay',
  resolve(step, ctx) {
    const resolvedConfig = interpolateDeep(step.config, ctx)
    const ms = Number(asRecord(resolvedConfig).ms ?? 0)
    return {
      step,
      resolvedConfig,
      policy: defaultPolicy(step),
      plannedAction: `delay ${ms}ms`
    }
  },
  async execute(resolved, ctx) {
    if (ctx.mode === 'dry-run') {
      ctx.emitLog('system', `planned: ${resolved.plannedAction}`)
      return { status: 'skipped_dry_run' }
    }
    const ms = Number(asRecord(resolved.resolvedConfig).ms ?? 0)
    await new Promise((r) => setTimeout(r, ms))
    return { status: 'succeeded' }
  }
}

const confirmHandler: StepTypeHandler = {
  type: 'confirm',
  resolve(step, ctx) {
    const resolvedConfig = interpolateDeep(step.config, ctx)
    const message = String(asRecord(resolvedConfig).message ?? 'Confirm?')
    return {
      step,
      resolvedConfig,
      policy: defaultPolicy(step),
      plannedAction: `confirm: ${message}`
    }
  },
  async execute(resolved, ctx) {
    if (ctx.mode === 'dry-run') {
      ctx.emitLog('system', `would confirm: ${resolved.plannedAction}`)
      return { status: 'skipped_dry_run' }
    }
    const message = String(asRecord(resolved.resolvedConfig).message ?? 'Confirm?')
    const ok = await ctx.requestConfirm(message)
    return { status: ok ? 'succeeded' : 'failed' }
  }
}

const setVariableHandler: StepTypeHandler = {
  type: 'set.variable',
  resolve(step, ctx) {
    const resolvedConfig = interpolateDeep(step.config, ctx)
    const cfg = asRecord(resolvedConfig)
    const key = String(cfg.key ?? '')
    const value = String(cfg.value ?? '')
    return {
      step,
      resolvedConfig,
      policy: defaultPolicy(step),
      plannedAction: `set ${key}=${value}`
    }
  },
  async execute(resolved, ctx) {
    const cfg = asRecord(resolved.resolvedConfig)
    const key = String(cfg.key ?? '')
    const value = String(cfg.value ?? '')
    ctx.setVariable(key, value)
    ctx.emitLog('system', `set ${key}=${value}`)
    if (ctx.mode === 'dry-run') {
      return { status: 'skipped_dry_run' }
    }
    return { status: 'succeeded' }
  }
}

const scriptHandler: StepTypeHandler = {
  type: 'script',
  resolve(step, ctx) {
    const resolvedConfig = interpolateDeep(step.config, ctx)
    const cfg = asRecord(resolvedConfig)
    const script = String(cfg.script ?? '')
    const cwd = cfg.cwd ? String(cfg.cwd) : undefined
    const planned = cwd ? `cd ${cwd} && ${script}` : script
    return { step, resolvedConfig, policy: defaultPolicy(step), plannedAction: planned }
  },
  async execute(resolved, ctx) {
    if (ctx.mode === 'dry-run') {
      ctx.emitLog('system', `planned script:\n${resolved.plannedAction}`)
      return { status: 'skipped_dry_run' }
    }
    const result = await ctx.exec(resolved.plannedAction, {
      timeoutMs: resolved.policy.timeoutMs,
      onStdout: (c) => ctx.emitLog('stdout', c),
      onStderr: (c) => ctx.emitLog('stderr', c)
    })
    return {
      status: result.exitCode === 0 ? 'succeeded' : 'failed',
      exitCode: result.exitCode
    }
  }
}

const handlers: StepTypeHandler[] = [
  sshExecHandler,
  delayHandler,
  confirmHandler,
  setVariableHandler,
  scriptHandler
]

export class StepTypeRegistry {
  private readonly map = new Map<string, StepTypeHandler>()

  constructor(items: StepTypeHandler[] = handlers) {
    for (const handler of items) {
      this.map.set(handler.type, handler)
    }
  }

  get(type: string): StepTypeHandler {
    const handler = this.map.get(type)
    if (!handler) {
      throw new Error(`Unknown step type: ${type}`)
    }
    return handler
  }

  resolve(step: WorkflowStep, ctx: InterpolateContext): ResolvedStep {
    return this.get(step.type).resolve(step, ctx)
  }

  execute(resolved: ResolvedStep, ctx: StepExecutionContext): Promise<StepExecuteResult> {
    return this.get(resolved.step.type).execute(resolved, ctx)
  }
}

export const defaultStepRegistry = new StepTypeRegistry()
