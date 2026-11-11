import { randomUUID } from 'node:crypto'
import type {
  Connection,
  ConnectionSecret,
  CreateGroupVariableInput,
  CreateWorkflowInput,
  Group,
  RunStatus,
  StartWorkflowRunInput,
  UpdateGroupVariableInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowRunRespondInput
} from '@shared/types'
import {
  cloneWorkflowDefinition,
  normalizeWorkflowName,
  WORKFLOW_SECRET_KINDS
} from '@shared/types'
import type { BrowserWindow } from 'electron'
import { BrowserWindow as BW } from 'electron'
import type { CredentialVault } from '../../vault'
import type { WorkflowStore } from '../../workspaces/workflow-store'
import { listGitTags as listGitTagsOnRemote } from './list-git-tags-service'
import { remoteExecService } from './remote-exec-service'
import { WorkflowEngine } from './workflow-engine'

/** VPN lease before reaching the host, same as a session (ADR 0017). */
export type WorkflowVpn = {
  ensure: (connection: Connection, leaseId: string) => Promise<void>
  release: (leaseId: string) => void
}

type ActiveRun = {
  engine: WorkflowEngine
  run: WorkflowRun
  /** Where the run's learned secrets go (the workspace it started in). */
  scope: WorkflowScope
}

/**
 * What a workflow needs from the active workspace (REC-024): its store, the
 * tree to find the target, and how to read the connection's own password.
 * Passwords a run learns (git, sudo) always go to this computer's vault.
 */
export type WorkflowScope = {
  store: WorkflowStore
  connection(id: string): Promise<Connection | null>
  group(id: string): Promise<Group | null>
  resolveSecret(credentialRef: string): Promise<string>
  /** The personal workspace only: a learned password may become the connection's own. */
  updateConnectionCredential?(connectionId: string, credentialRef: string | null): Promise<void>
}

/**
 * Orchestrates workflow CRUD side-effects and live runs.
 */
export class WorkflowService {
  private readonly active = new Map<string, ActiveRun>()

  constructor(
    private readonly scope: () => WorkflowScope,
    private readonly vault: CredentialVault,
    private readonly emitEvent: (runId: string, event: WorkflowRunEvent) => void,
    private readonly vpn: WorkflowVpn | null = null
  ) {}

  listWorkflows(groupId: string) {
    return this.scope().store.workflows.listByGroup(groupId)
  }

  getWorkflow(id: string) {
    return this.scope().store.workflows.get(id)
  }

  private async secretsOf(scope: WorkflowScope, connectionId: string) {
    return async (kind: string): Promise<string | null> => {
      const entry = scope.store.connectionSecrets.getByKind(connectionId, kind)
      if (!entry) return null
      return this.vault.resolveSecret(entry.credentialRef)
    }
  }

  /**
   * Ad-hoc, one-shot `git fetch --tags` + list on the connection's host —
   * not a workflow run, just powers a select input's live tag dropdown in
   * the run-parameters dialog before the actual run starts.
   */
  async listGitTags(connectionId: string, repositoryPath: string): Promise<string[]> {
    const scope = this.scope()
    const connection = await scope.connection(connectionId)
    if (!connection) throw new Error('Conexão não encontrada')

    const resolveConnectionSecret = await this.secretsOf(scope, connectionId)
    const gitPassword = await resolveConnectionSecret(WORKFLOW_SECRET_KINDS.git)
    const gitUsername = await resolveConnectionSecret(WORKFLOW_SECRET_KINDS.gitUsername)
    const sudoPassword = await resolveConnectionSecret(WORKFLOW_SECRET_KINDS.sudo)

    const leaseId = `git-tags:${randomUUID()}`
    let session: Awaited<ReturnType<typeof remoteExecService.openSession>>
    try {
      await this.vpn?.ensure(connection, leaseId)
      session = await remoteExecService.openSession({
        connection,
        resolveSecret: (ref) => scope.resolveSecret(ref),
        verifyHostKey: async () => true
      })
    } catch (error) {
      this.vpn?.release(leaseId)
      throw error
    }
    try {
      return await listGitTagsOnRemote(
        session,
        repositoryPath,
        gitPassword ? { username: gitUsername ?? undefined, password: gitPassword } : undefined,
        sudoPassword ?? undefined
      )
    } finally {
      await session.dispose()
      this.vpn?.release(leaseId)
    }
  }

  createWorkflow(input: CreateWorkflowInput) {
    return this.scope().store.workflows.create(input)
  }

  async copyWorkflow(workflowId: string, targetGroupIds: string[], allowDuplicateNames = false) {
    const scope = this.scope()
    const source = await scope.store.workflows.get(workflowId)
    if (!source) {
      throw new Error('Workflow not found')
    }
    const uniqueTargets = [...new Set(targetGroupIds)].filter((id) => id !== source.groupId)
    if (uniqueTargets.length === 0) {
      throw new Error('Selecione ao menos um grupo diferente do atual')
    }

    const sourceKey = normalizeWorkflowName(source.name)
    const conflicts: string[] = []
    for (const groupId of uniqueTargets) {
      if (!(await scope.group(groupId))) {
        throw new Error(`Group not found: ${groupId}`)
      }
      const hasSameName = (await scope.store.workflows.listByGroup(groupId)).some(
        (w) => normalizeWorkflowName(w.name) === sourceKey
      )
      if (hasSameName) conflicts.push(groupId)
    }

    if (conflicts.length > 0 && !allowDuplicateNames) {
      throw new Error(
        `Já existe um workflow chamado "${source.name}" em ${conflicts.length === 1 ? 'um grupo destino' : `${conflicts.length} grupos destino`}. Desmarque o destino ou marque “Criar mesmo assim”.`
      )
    }

    const created: Workflow[] = []
    for (const groupId of uniqueTargets) {
      created.push(
        await scope.store.workflows.create({
          groupId,
          name: source.name,
          description: source.description,
          icon: source.icon,
          preferredConnectionId: null,
          definition: cloneWorkflowDefinition(source.definition)
        })
      )
    }
    return created
  }

  updateWorkflow(id: string, input: UpdateWorkflowInput) {
    return this.scope().store.workflows.update(id, input)
  }

  deleteWorkflow(id: string) {
    return this.scope().store.workflows.delete(id)
  }

  listVariables(groupId: string) {
    return this.scope().store.variables.listByGroup(groupId)
  }

  createVariable(input: CreateGroupVariableInput) {
    return this.scope().store.variables.create(input)
  }

  updateVariable(id: string, input: UpdateGroupVariableInput) {
    return this.scope().store.variables.update(id, input)
  }

  deleteVariable(id: string) {
    return this.scope().store.variables.delete(id)
  }

  listRuns(groupId: string, limit?: number) {
    return this.scope().store.runs.listByGroup(groupId, limit)
  }

  getRun(id: string) {
    return this.scope().store.runs.get(id)
  }

  listConnectionSecrets(connectionId: string): ConnectionSecret[] {
    return this.scope().store.connectionSecrets.listByConnection(connectionId)
  }

  async setConnectionSecret(
    connectionId: string,
    kind: string,
    secret: string,
    scope: WorkflowScope = this.scope()
  ): Promise<ConnectionSecret> {
    const connection = await scope.connection(connectionId)
    if (!connection) {
      throw new Error('Connection not found')
    }
    const secrets = scope.store.connectionSecrets
    const existing = secrets.getByKind(connectionId, kind)
    const credentialRef = this.vault.setSecret(secret, existing?.credentialRef)
    const entry = secrets.upsert(connectionId, kind, credentialRef)

    // Keep legacy credentialRef in sync for primary auth kinds.
    if (kind === 'password' || kind === 'passphrase') {
      await scope.updateConnectionCredential?.(connectionId, credentialRef)
    }
    return entry
  }

  async deleteConnectionSecret(connectionId: string, kind: string): Promise<void> {
    const scope = this.scope()
    const secrets = scope.store.connectionSecrets
    const existing = secrets.getByKind(connectionId, kind)
    if (!existing) return
    secrets.deleteByKind(connectionId, kind)
    this.vault.deleteSecret(existing.credentialRef)
    if (
      (kind === 'password' || kind === 'passphrase') &&
      (await scope.connection(connectionId))?.credentialRef === existing.credentialRef
    ) {
      await scope.updateConnectionCredential?.(connectionId, null)
    }
  }

  async startRun(input: StartWorkflowRunInput): Promise<WorkflowRun> {
    const scope = this.scope()
    const { store } = scope
    const workflow = await store.workflows.get(input.workflowId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }
    if (input.targets.length !== 1) {
      throw new Error('MVP supports exactly one target connection')
    }
    const target = input.targets[0]
    if (!target) {
      throw new Error('Missing target')
    }
    const connection = await scope.connection(target.connectionId)
    if (!connection) {
      throw new Error('Target connection not found')
    }
    if (connection.protocol !== 'ssh') {
      throw new Error('Workflows MVP requires an SSH connection target')
    }

    const groupVariables: Record<string, string> = {}
    for (const variable of await store.variables.listByGroup(workflow.groupId)) {
      groupVariables[variable.key] = variable.value
    }
    const environmentId = (await scope.group(connection.groupId))?.environmentId ?? null
    const inputValues = input.inputValues ?? {}
    const variablesSnapshot = { ...groupVariables }
    for (const def of workflow.definition.inputs) {
      if (def.default !== undefined && !(def.key in inputValues)) {
        variablesSnapshot[def.key] =
          typeof def.default === 'boolean' ? (def.default ? 'true' : 'false') : String(def.default)
      }
    }
    for (const [key, value] of Object.entries(inputValues)) {
      variablesSnapshot[key] = typeof value === 'boolean' ? (value ? 'true' : 'false') : value
    }

    const run = store.runs.create({
      workflowId: workflow.id,
      groupId: workflow.groupId,
      mode: input.mode,
      status: 'pending',
      targets: input.targets,
      definitionSnapshot: structuredClone(workflow.definition),
      variablesSnapshot,
      inputValues
    })
    const resolveConnectionSecret = await this.secretsOf(scope, connection.id)

    const engine = new WorkflowEngine({
      onEvent: (event) => this.emitEvent(run.id, event),
      persistStatus: (status, finishedAt) => {
        store.runs.updateStatus(run.id, status, finishedAt)
      },
      openExecSession: async () => {
        await this.vpn?.ensure(connection, `workflow:${run.id}`)
        return remoteExecService.openSession({
          connection,
          resolveSecret: (ref) => scope.resolveSecret(ref),
          verifyHostKey: async () => true
        })
      },
      resolveConnectionSecret,
      onTrackingComplete: (data) => {
        if (!environmentId) return
        // In an organization this lands on the server, signed with whoever ran it.
        void store.updates
          .create({
            environmentId,
            connectionId: connection.id,
            workflowId: workflow.id,
            workflowRunId: run.id,
            branch: data.before.branch,
            previousCommit: data.before.commit,
            currentCommit: data.currentCommit,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
            status: data.status,
            commits: data.commits,
            filesChanged: data.filesChanged,
            tag: data.tag
          })
          .catch(() => {
            // history persistence must never affect the already-finished run
          })
      }
    })

    this.active.set(run.id, { engine, run, scope })

    void engine
      .run({
        runId: run.id,
        mode: input.mode,
        definition: run.definitionSnapshot,
        groupVariables,
        inputValues
      })
      .catch(() => {
        // the engine reports failures as events; nothing to surface here
      })
      .finally(() => {
        this.active.delete(run.id)
        this.vpn?.release(`workflow:${run.id}`)
      })

    return run
  }

  async respond(input: WorkflowRunRespondInput): Promise<void> {
    const active = this.active.get(input.runId)
    if (!active) {
      throw new Error('Run is not active')
    }

    if (input.action === 'provide_secret' && input.secret) {
      if (input.learnToSave && input.secretKind) {
        const connectionId = active.run.targets[0]?.connectionId
        if (connectionId) {
          await this.setConnectionSecret(connectionId, input.secretKind, input.secret, active.scope)
          if (input.username && input.secretKind === 'git') {
            await this.setConnectionSecret(
              connectionId,
              'git_username',
              input.username,
              active.scope
            )
          }
        }
      }
      active.engine.respond({
        action: 'provide_secret',
        secret: input.secret,
        username: input.username,
        secretKind: input.secretKind,
        learnToSave: input.learnToSave
      })
      return
    }

    if (input.action === 'cancel') {
      active.engine.cancel()
      return
    }
    if (input.action === 'confirm') {
      active.engine.respond({ action: 'confirm' })
      return
    }
    if (input.action === 'retry') {
      active.engine.respond({ action: 'retry' })
      return
    }
    if (input.action === 'continue') {
      active.engine.respond({ action: 'continue' })
    }
  }

  cancel(runId: string): void {
    const active = this.active.get(runId)
    if (!active) return
    active.engine.cancel()
  }

  getActiveStatus(runId: string): RunStatus | null {
    const run =
      this.active.get(runId)?.scope.store.runs.get(runId) ?? this.scope().store.runs.get(runId)
    return run?.status ?? null
  }
}

export function broadcastWorkflowEvent(
  channel: string,
  payload: { runId: string; event: WorkflowRunEvent }
): void {
  for (const win of BW.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

export function getFocusedWindow(): BrowserWindow | null {
  return BW.getFocusedWindow()
}
