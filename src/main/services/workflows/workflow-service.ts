import type {
  ConnectionSecret,
  RunStatus,
  StartWorkflowRunInput,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowRunRespondInput
} from '@shared/types'
import { cloneWorkflowDefinition, normalizeWorkflowName } from '@shared/types'
import type { BrowserWindow } from 'electron'
import { BrowserWindow as BW } from 'electron'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'
import { remoteExecService } from './remote-exec-service'
import { WorkflowEngine } from './workflow-engine'

type ActiveRun = {
  engine: WorkflowEngine
  run: WorkflowRun
}

/**
 * Orchestrates workflow CRUD side-effects and live runs.
 */
export class WorkflowService {
  private readonly active = new Map<string, ActiveRun>()

  constructor(
    private readonly repos: Repositories,
    private readonly vault: CredentialVault,
    private readonly emitEvent: (runId: string, event: WorkflowRunEvent) => void
  ) {}

  listWorkflows(groupId: string) {
    return this.repos.workflows.listByGroup(groupId)
  }

  getWorkflow(id: string) {
    return this.repos.workflows.get(id)
  }

  createWorkflow(...args: Parameters<Repositories['workflows']['create']>) {
    return this.repos.workflows.create(...args)
  }

  copyWorkflow(workflowId: string, targetGroupIds: string[], allowDuplicateNames = false) {
    const source = this.repos.workflows.get(workflowId)
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
      if (!this.repos.groups.get(groupId)) {
        throw new Error(`Group not found: ${groupId}`)
      }
      const hasSameName = this.repos.workflows
        .listByGroup(groupId)
        .some((w) => normalizeWorkflowName(w.name) === sourceKey)
      if (hasSameName) conflicts.push(groupId)
    }

    if (conflicts.length > 0 && !allowDuplicateNames) {
      throw new Error(
        `Já existe um workflow chamado "${source.name}" em ${conflicts.length === 1 ? 'um grupo destino' : `${conflicts.length} grupos destino`}. Desmarque o destino ou marque “Criar mesmo assim”.`
      )
    }

    const created: ReturnType<Repositories['workflows']['create']>[] = []
    for (const groupId of uniqueTargets) {
      created.push(
        this.repos.workflows.create({
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

  updateWorkflow(...args: Parameters<Repositories['workflows']['update']>) {
    return this.repos.workflows.update(...args)
  }

  deleteWorkflow(id: string) {
    return this.repos.workflows.delete(id)
  }

  listVariables(groupId: string) {
    return this.repos.groupVariables.listByGroup(groupId)
  }

  createVariable(...args: Parameters<Repositories['groupVariables']['create']>) {
    return this.repos.groupVariables.create(...args)
  }

  updateVariable(...args: Parameters<Repositories['groupVariables']['update']>) {
    return this.repos.groupVariables.update(...args)
  }

  deleteVariable(id: string) {
    return this.repos.groupVariables.delete(id)
  }

  listRuns(groupId: string, limit?: number) {
    return this.repos.workflowRuns.listByGroup(groupId, limit)
  }

  getRun(id: string) {
    return this.repos.workflowRuns.get(id)
  }

  listConnectionSecrets(connectionId: string): ConnectionSecret[] {
    return this.repos.connectionSecrets.listByConnection(connectionId)
  }

  async setConnectionSecret(
    connectionId: string,
    kind: string,
    secret: string
  ): Promise<ConnectionSecret> {
    const connection = this.repos.connections.get(connectionId)
    if (!connection) {
      throw new Error('Connection not found')
    }
    const existing = this.repos.connectionSecrets.getByKind(connectionId, kind)
    const credentialRef = this.vault.setSecret(secret, existing?.credentialRef)
    const entry = this.repos.connectionSecrets.upsert(connectionId, kind, credentialRef)

    // Keep legacy credentialRef in sync for primary auth kinds.
    if (kind === 'password' || kind === 'passphrase') {
      this.repos.connections.update(connectionId, { credentialRef })
    }
    return entry
  }

  async deleteConnectionSecret(connectionId: string, kind: string): Promise<void> {
    const existing = this.repos.connectionSecrets.getByKind(connectionId, kind)
    if (!existing) return
    this.repos.connectionSecrets.deleteByKind(connectionId, kind)
    this.vault.deleteSecret(existing.credentialRef)
    if (
      (kind === 'password' || kind === 'passphrase') &&
      this.repos.connections.get(connectionId)?.credentialRef === existing.credentialRef
    ) {
      this.repos.connections.update(connectionId, { credentialRef: null })
    }
  }

  async startRun(input: StartWorkflowRunInput): Promise<WorkflowRun> {
    const workflow = this.repos.workflows.get(input.workflowId)
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
    const connection = this.repos.connections.get(target.connectionId)
    if (!connection) {
      throw new Error('Target connection not found')
    }
    if (connection.protocol !== 'ssh') {
      throw new Error('Workflows MVP requires an SSH connection target')
    }

    const groupVariables = this.repos.groupVariables.toRecord(workflow.groupId)
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

    const run = this.repos.workflowRuns.create({
      workflowId: workflow.id,
      groupId: workflow.groupId,
      mode: input.mode,
      status: 'pending',
      targets: input.targets,
      definitionSnapshot: structuredClone(workflow.definition),
      variablesSnapshot,
      inputValues
    })

    const engine = new WorkflowEngine({
      onEvent: (event) => this.emitEvent(run.id, event),
      persistStatus: (status, finishedAt) => {
        this.repos.workflowRuns.updateStatus(run.id, status, finishedAt)
      },
      openExecSession: async () => {
        return remoteExecService.openSession({
          connection,
          resolveSecret: async (ref) => this.vault.resolveSecret(ref),
          verifyHostKey: async () => true
        })
      },
      resolveConnectionSecret: async (kind) => {
        const entry = this.repos.connectionSecrets.getByKind(connection.id, kind)
        if (!entry) return null
        return this.vault.resolveSecret(entry.credentialRef)
      }
    })

    this.active.set(run.id, { engine, run })

    void engine
      .run({
        runId: run.id,
        mode: input.mode,
        definition: run.definitionSnapshot,
        groupVariables,
        inputValues
      })
      .finally(() => {
        this.active.delete(run.id)
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
          await this.setConnectionSecret(connectionId, input.secretKind, input.secret)
          if (input.username && input.secretKind === 'git') {
            await this.setConnectionSecret(connectionId, 'git_username', input.username)
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
    const run = this.repos.workflowRuns.get(runId)
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
