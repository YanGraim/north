import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const RunModeSchema = z.enum(['live', 'dry-run'])
export type RunMode = z.infer<typeof RunModeSchema>

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'paused'
])
export type RunStatus = z.infer<typeof RunStatusSchema>

export const StepRunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'skipped_dry_run',
  'cancelled'
])
export type StepRunStatus = z.infer<typeof StepRunStatusSchema>

export const StepFailureActionSchema = z.enum(['stop', 'continue', 'ask'])
export type StepFailureAction = z.infer<typeof StepFailureActionSchema>

export const StepPolicySchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
  onFailure: StepFailureActionSchema.default('stop'),
  requiresConfirmation: z.boolean().optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().positive(),
      backoffMs: z.number().int().nonnegative().optional()
    })
    .optional()
})
export type StepPolicy = z.infer<typeof StepPolicySchema>

export const WorkflowStepTypeSchema = z.enum([
  'ssh.exec',
  'delay',
  'confirm',
  'set.variable',
  'script'
])
export type WorkflowStepType = z.infer<typeof WorkflowStepTypeSchema>

export const WorkflowStepSchema = z.object({
  id: IdSchema,
  type: z.string().min(1),
  name: z.string().min(1),
  policy: StepPolicySchema,
  config: z.unknown()
})
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>

export const WorkflowInputSchema = z.object({
  id: IdSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'select', 'boolean']),
  required: z.boolean(),
  default: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional()
})
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>

export const WorkflowDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  inputs: z.array(WorkflowInputSchema),
  steps: z.array(WorkflowStepSchema)
})
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const emptyWorkflowDefinition = (): WorkflowDefinition => ({
  schemaVersion: 1,
  inputs: [],
  steps: []
})

export const WorkflowSchema = z.object({
  id: IdSchema,
  groupId: IdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  preferredConnectionId: IdSchema.nullable(),
  sortOrder: z.number().int(),
  definition: WorkflowDefinitionSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type Workflow = z.infer<typeof WorkflowSchema>

export const CreateWorkflowInputSchema = z.object({
  groupId: IdSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  preferredConnectionId: IdSchema.nullable().optional(),
  sortOrder: z.number().int().optional(),
  definition: WorkflowDefinitionSchema.optional()
})
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>

export const UpdateWorkflowInputSchema = CreateWorkflowInputSchema.omit({ groupId: true })
  .partial()
  .extend({
    groupId: IdSchema.optional()
  })
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInputSchema>

/** Copy an existing workflow into one or more target groups (independent clones). */
export const CopyWorkflowInputSchema = z.object({
  workflowId: IdSchema,
  targetGroupIds: z.array(IdSchema).min(1),
  /** When false (default), refuse if a workflow with the same name already exists in a target. */
  allowDuplicateNames: z.boolean().optional().default(false)
})
export type CopyWorkflowInput = z.infer<typeof CopyWorkflowInputSchema>

export function normalizeWorkflowName(name: string): string {
  return name.trim().toLowerCase()
}

/** Deep-clone a definition with fresh step/input ids (safe across groups). */
export function cloneWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    schemaVersion: definition.schemaVersion,
    inputs: definition.inputs.map((input) => ({
      ...input,
      id: crypto.randomUUID()
    })),
    steps: definition.steps.map((step) => ({
      ...structuredClone(step),
      id: crypto.randomUUID()
    }))
  }
}

export const GroupVariableSchema = z.object({
  id: IdSchema,
  groupId: IdSchema,
  key: z.string().min(1),
  value: z.string(),
  description: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type GroupVariable = z.infer<typeof GroupVariableSchema>

export const CreateGroupVariableInputSchema = z.object({
  groupId: IdSchema,
  key: z.string().min(1),
  value: z.string(),
  description: z.string().nullable().optional()
})
export type CreateGroupVariableInput = z.infer<typeof CreateGroupVariableInputSchema>

export const UpdateGroupVariableInputSchema = z.object({
  key: z.string().min(1).optional(),
  value: z.string().optional(),
  description: z.string().nullable().optional()
})
export type UpdateGroupVariableInput = z.infer<typeof UpdateGroupVariableInputSchema>

export const WorkflowRunTargetSchema = z.object({
  connectionId: IdSchema
})
export type WorkflowRunTarget = z.infer<typeof WorkflowRunTargetSchema>

export const WorkflowRunSchema = z.object({
  id: IdSchema,
  workflowId: IdSchema,
  groupId: IdSchema,
  mode: RunModeSchema,
  status: RunStatusSchema,
  targets: z.array(WorkflowRunTargetSchema).min(1),
  definitionSnapshot: WorkflowDefinitionSchema,
  variablesSnapshot: z.record(z.string(), z.string()),
  inputValues: z.record(z.string(), z.union([z.string(), z.boolean()])),
  startedAt: IsoDateSchema,
  finishedAt: IsoDateSchema.nullable()
})
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>

export const StartWorkflowRunInputSchema = z.object({
  workflowId: IdSchema,
  mode: RunModeSchema.default('live'),
  targets: z.array(WorkflowRunTargetSchema).length(1),
  inputValues: z.record(z.string(), z.union([z.string(), z.boolean()])).optional()
})
export type StartWorkflowRunInput = z.infer<typeof StartWorkflowRunInputSchema>

export const WorkflowRunPauseActionSchema = z.enum([
  'confirm',
  'retry',
  'continue',
  'cancel',
  'provide_secret'
])
export type WorkflowRunPauseAction = z.infer<typeof WorkflowRunPauseActionSchema>

export const WorkflowRunRespondInputSchema = z.object({
  runId: IdSchema,
  action: WorkflowRunPauseActionSchema,
  secret: z.string().optional(),
  username: z.string().optional(),
  secretKind: z.string().optional(),
  learnToSave: z.boolean().optional()
})
export type WorkflowRunRespondInput = z.infer<typeof WorkflowRunRespondInputSchema>

export const WorkflowRunEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('run_started'),
    runId: z.string(),
    totalSteps: z.number().int(),
    mode: RunModeSchema
  }),
  z.object({
    type: z.literal('run_progress'),
    completedSteps: z.number().int(),
    totalSteps: z.number().int(),
    currentStepId: z.string().nullable()
  }),
  z.object({
    type: z.literal('step_started'),
    stepId: z.string(),
    index: z.number().int()
  }),
  z.object({
    type: z.literal('step_log'),
    stepId: z.string(),
    stream: z.enum(['stdout', 'stderr', 'system']),
    chunk: z.string()
  }),
  z.object({
    type: z.literal('step_finished'),
    stepId: z.string(),
    status: StepRunStatusSchema,
    durationMs: z.number(),
    exitCode: z.number().int().optional()
  }),
  z.object({
    type: z.literal('run_paused'),
    reason: z.enum(['confirm', 'auth', 'on_failure_ask']),
    stepId: z.string()
  }),
  z.object({
    type: z.literal('run_finished'),
    status: RunStatusSchema,
    durationMs: z.number()
  }),
  z.object({
    type: z.literal('auth_prompt'),
    stepId: z.string(),
    kind: z.string(),
    message: z.string(),
    canLearn: z.boolean(),
    needsUsername: z.boolean().optional()
  })
])
export type WorkflowRunEvent = z.infer<typeof WorkflowRunEventSchema>

export const ConnectionSecretKindSchema = z.string().min(1)
export type ConnectionSecretKind = z.infer<typeof ConnectionSecretKindSchema>

export const ConnectionSecretSchema = z.object({
  id: IdSchema,
  connectionId: IdSchema,
  kind: ConnectionSecretKindSchema,
  credentialRef: IdSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type ConnectionSecret = z.infer<typeof ConnectionSecretSchema>

export const SetConnectionSecretInputSchema = z.object({
  connectionId: IdSchema,
  kind: ConnectionSecretKindSchema,
  secret: z.string().min(1)
})
export type SetConnectionSecretInput = z.infer<typeof SetConnectionSecretInputSchema>

export const AuthHintSchema = z.enum(['sudo', 'git'])
export type AuthHint = z.infer<typeof AuthHintSchema>

/** Known connection_secrets kinds used when authHints are enabled. */
export const WORKFLOW_SECRET_KINDS = {
  sudo: 'sudo',
  git: 'git',
  gitUsername: 'git_username'
} as const

const SshExecStepConfigObjectSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  authHints: z.array(AuthHintSchema).default([])
})

/**
 * Parses ssh.exec config. Accepts legacy `authHint: 'sudo'|'git'|'none'` mapped to authHints[].
 * Absence / empty = no auth wrapping (raw remote exec).
 */
export const SshExecStepConfigSchema = z.preprocess((raw) => {
  if (raw === null || typeof raw !== 'object') return raw
  const obj = { ...(raw as Record<string, unknown>) }
  if (Array.isArray(obj.authHints)) return obj
  if (obj.authHint === 'sudo' || obj.authHint === 'git') {
    obj.authHints = [obj.authHint]
    return obj
  }
  if (obj.authHint === 'none' || obj.authHint === undefined) {
    obj.authHints = []
  }
  return obj
}, SshExecStepConfigObjectSchema)

export type SshExecStepConfig = z.infer<typeof SshExecStepConfigObjectSchema>

export function parseAuthHints(config: unknown): AuthHint[] {
  const parsed = SshExecStepConfigSchema.safeParse(
    config !== null && typeof config === 'object'
      ? { command: 'x', ...(config as object) }
      : { command: 'x' }
  )
  return parsed.success ? parsed.data.authHints : []
}

export const DelayStepConfigSchema = z.object({
  ms: z.number().int().nonnegative()
})
export type DelayStepConfig = z.infer<typeof DelayStepConfigSchema>

export const ConfirmStepConfigSchema = z.object({
  message: z.string().min(1)
})
export type ConfirmStepConfig = z.infer<typeof ConfirmStepConfigSchema>

export const SetVariableStepConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string()
})
export type SetVariableStepConfig = z.infer<typeof SetVariableStepConfigSchema>

export const ScriptStepConfigSchema = z.object({
  script: z.string().min(1),
  cwd: z.string().optional()
})
export type ScriptStepConfig = z.infer<typeof ScriptStepConfigSchema>
