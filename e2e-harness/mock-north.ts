import type { RemoteEntry, SessionDescriptor, TransferProgress } from '@shared/protocols'
import type {
  Access,
  Client,
  Connection,
  ConnectionSecret,
  CopyWorkflowInput,
  CreateGroupVariableInput,
  CreateWorkflowInput,
  Environment,
  Group,
  GroupVariable,
  SetConnectionSecretInput,
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
  emptyWorkflowDefinition,
  normalizeWorkflowName
} from '@shared/types'

type RunListener = (payload: { runId: string; event: WorkflowRunEvent }) => void
type ProgressListener = (progress: TransferProgress) => void

/** Workflows harness (non-UUID ids — only used by WorkflowSection UI). */
const CLIENT_ID = 'client-1'
const CLIENT_B_ID = 'client-2'
const ENV_ID = 'env-1'
const ENV_B_ID = 'env-2'
const GROUP_ID = 'group-1'
const GROUP_B_ID = 'group-2'
const CONNECTION_ID = 'conn-1'

/** FTP harness — real UUIDs for Connection / SessionDescriptor contracts. */
const FTP_CLIENT_ID = 'a1000000-0000-4000-8000-000000000001'
const FTP_ENV_ID = 'a2000000-0000-4000-8000-000000000002'
const FTP_GROUP_ID = 'a3000000-0000-4000-8000-000000000003'
const FTP_CONNECTION_ID = 'a4000000-0000-4000-8000-000000000004'

const DB_CLIENT_ID = 'b1000000-0000-4000-8000-000000000001'
const DB_ENV_ID = 'b2000000-0000-4000-8000-000000000002'
const DB_GROUP_ID = 'b3000000-0000-4000-8000-000000000003'
const DB_ACCESS_ID = 'b4000000-0000-4000-8000-000000000004'

let workflows: Workflow[] = []
let variables: GroupVariable[] = []
let runs: WorkflowRun[] = []
let secrets: ConnectionSecret[] = []
const listeners = new Set<RunListener>()
const eventHistory = new Map<string, WorkflowRunEvent[]>()
const activePauses = new Map<
  string,
  { resolve: (action: WorkflowRunRespondInput['action']) => void; stepId: string }
>()

function now(): string {
  return new Date().toISOString()
}

function emit(runId: string, event: WorkflowRunEvent): void {
  const history = eventHistory.get(runId) ?? []
  history.push(event)
  eventHistory.set(runId, history)
  for (const listener of listeners) {
    listener({ runId, event })
  }
}

async function simulateRun(run: WorkflowRun, scenario: string): Promise<void> {
  const steps = run.definitionSnapshot.steps
  emit(run.id, {
    type: 'run_started',
    runId: run.id,
    totalSteps: steps.length,
    mode: run.mode
  })

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]
    if (!step) continue
    emit(run.id, {
      type: 'run_progress',
      completedSteps: index,
      totalSteps: steps.length,
      currentStepId: step.id
    })
    emit(run.id, { type: 'step_started', stepId: step.id, index })

    const command =
      step.config && typeof step.config === 'object' && 'command' in step.config
        ? String((step.config as { command: string }).command)
        : step.name

    let resolved = command
    for (const [key, value] of Object.entries(run.variablesSnapshot)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value)
    }
    for (const [key, value] of Object.entries(run.inputValues)) {
      resolved = resolved.replaceAll(
        `{{${key}}}`,
        typeof value === 'boolean' ? String(value) : value
      )
    }

    emit(run.id, {
      type: 'step_log',
      stepId: step.id,
      stream: 'system',
      chunk: `planned: ${resolved}\n`
    })

    if (scenario === 'fail-first' && index === 0) {
      emit(run.id, {
        type: 'step_log',
        stepId: step.id,
        stream: 'stderr',
        chunk: "fatal: could not read Username for 'https://bitbucket.org'\n"
      })
      emit(run.id, {
        type: 'step_finished',
        stepId: step.id,
        status: 'failed',
        durationMs: 12,
        exitCode: 1
      })
      emit(run.id, { type: 'run_finished', status: 'failed', durationMs: 20 })
      run.status = 'failed'
      run.finishedAt = now()
      return
    }

    if (scenario === 'fail-ask' && index === 1) {
      emit(run.id, {
        type: 'step_finished',
        stepId: step.id,
        status: 'failed',
        durationMs: 12,
        exitCode: 1
      })
      emit(run.id, { type: 'run_paused', reason: 'on_failure_ask', stepId: step.id })
      const action = await new Promise<WorkflowRunRespondInput['action']>((resolve) => {
        activePauses.set(run.id, { resolve, stepId: step.id })
      })
      activePauses.delete(run.id)
      if (action === 'cancel') {
        emit(run.id, { type: 'run_finished', status: 'cancelled', durationMs: 40 })
        run.status = 'cancelled'
        run.finishedAt = now()
        return
      }
      if (action === 'continue') {
        continue
      }
      emit(run.id, { type: 'step_started', stepId: step.id, index })
      emit(run.id, {
        type: 'step_finished',
        stepId: step.id,
        status: 'succeeded',
        durationMs: 5,
        exitCode: 0
      })
      continue
    }

    emit(run.id, {
      type: 'step_log',
      stepId: step.id,
      stream: 'stdout',
      chunk: 'ok\n'
    })
    emit(run.id, {
      type: 'step_finished',
      stepId: step.id,
      status: run.mode === 'dry-run' ? 'skipped_dry_run' : 'succeeded',
      durationMs: 8,
      exitCode: 0
    })
  }

  emit(run.id, {
    type: 'run_progress',
    completedSteps: steps.length,
    totalSteps: steps.length,
    currentStepId: null
  })
  emit(run.id, { type: 'run_finished', status: 'succeeded', durationMs: 42 })
  run.status = 'succeeded'
  run.finishedAt = now()
}

function createWorkflowsApi(runScenario: string) {
  return {
    list: async (groupId: string) => workflows.filter((w) => w.groupId === groupId),
    get: async (id: string) => workflows.find((w) => w.id === id) ?? null,
    create: async (input: CreateWorkflowInput) => {
      const workflow: Workflow = {
        id: crypto.randomUUID(),
        groupId: input.groupId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        preferredConnectionId: input.preferredConnectionId ?? null,
        sortOrder: input.sortOrder ?? 0,
        definition: input.definition ?? emptyWorkflowDefinition(),
        createdAt: now(),
        updatedAt: now()
      }
      workflows = [...workflows, workflow]
      return workflow
    },
    copy: async (input: CopyWorkflowInput) => {
      const source = workflows.find((w) => w.id === input.workflowId)
      if (!source) throw new Error('Workflow not found')
      const targets = [...new Set(input.targetGroupIds)].filter((id) => id !== source.groupId)
      if (targets.length === 0) throw new Error('Selecione ao menos um grupo diferente do atual')
      const sourceKey = normalizeWorkflowName(source.name)
      const conflicts = targets.filter((groupId) =>
        workflows.some((w) => w.groupId === groupId && normalizeWorkflowName(w.name) === sourceKey)
      )
      if (conflicts.length > 0 && !input.allowDuplicateNames) {
        throw new Error(
          `Já existe um workflow chamado "${source.name}" em ${conflicts.length === 1 ? 'um grupo destino' : `${conflicts.length} grupos destino`}. Desmarque o destino ou marque “Criar mesmo assim”.`
        )
      }
      const created: Workflow[] = []
      for (const groupId of targets) {
        const copy: Workflow = {
          id: crypto.randomUUID(),
          groupId,
          name: source.name,
          description: source.description,
          icon: source.icon,
          preferredConnectionId: null,
          sortOrder: source.sortOrder,
          definition: cloneWorkflowDefinition(source.definition),
          createdAt: now(),
          updatedAt: now()
        }
        workflows = [...workflows, copy]
        created.push(copy)
      }
      return created
    },
    update: async (id: string, input: UpdateWorkflowInput) => {
      const idx = workflows.findIndex((w) => w.id === id)
      if (idx < 0) throw new Error('not found')
      const current = workflows[idx]
      if (!current) throw new Error('not found')
      const updated: Workflow = {
        ...current,
        ...input,
        description: input.description === undefined ? current.description : input.description,
        definition: input.definition ?? current.definition,
        updatedAt: now()
      }
      workflows = workflows.map((w) => (w.id === id ? updated : w))
      return updated
    },
    delete: async (id: string) => {
      workflows = workflows.filter((w) => w.id !== id)
    },
    listVariables: async (groupId: string) => variables.filter((v) => v.groupId === groupId),
    createVariable: async (input: CreateGroupVariableInput) => {
      const variable: GroupVariable = {
        id: crypto.randomUUID(),
        groupId: input.groupId,
        key: input.key,
        value: input.value,
        description: input.description ?? null,
        createdAt: now(),
        updatedAt: now()
      }
      variables = [...variables, variable]
      return variable
    },
    updateVariable: async (id: string, input: UpdateGroupVariableInput) => {
      const current = variables.find((v) => v.id === id)
      if (!current) throw new Error('not found')
      const updated = { ...current, ...input, updatedAt: now() }
      variables = variables.map((v) => (v.id === id ? updated : v))
      return updated
    },
    deleteVariable: async (id: string) => {
      variables = variables.filter((v) => v.id !== id)
    },
    listRuns: async (groupId: string) => runs.filter((r) => r.groupId === groupId),
    getRun: async (id: string) => runs.find((r) => r.id === id) ?? null,
    run: async (input: StartWorkflowRunInput) => {
      const workflow = workflows.find((w) => w.id === input.workflowId)
      if (!workflow) throw new Error('Workflow not found')
      const varSnap: Record<string, string> = {}
      for (const v of variables.filter((x) => x.groupId === workflow.groupId)) {
        varSnap[v.key] = v.value
      }
      for (const [k, v] of Object.entries(input.inputValues ?? {})) {
        varSnap[k] = typeof v === 'boolean' ? String(v) : v
      }
      const run: WorkflowRun = {
        id: crypto.randomUUID(),
        workflowId: workflow.id,
        groupId: workflow.groupId,
        mode: input.mode ?? 'live',
        status: 'running',
        targets: input.targets,
        definitionSnapshot: structuredClone(workflow.definition),
        variablesSnapshot: varSnap,
        inputValues: input.inputValues ?? {},
        startedAt: now(),
        finishedAt: null
      }
      runs = [run, ...runs]
      window.setTimeout(() => {
        void simulateRun(run, runScenario)
      }, 30)
      return run
    },
    respond: async (input: WorkflowRunRespondInput) => {
      const pause = activePauses.get(input.runId)
      pause?.resolve(input.action)
    },
    cancel: async (runId: string) => {
      const pause = activePauses.get(runId)
      pause?.resolve('cancel')
    },
    listConnectionSecrets: async (connectionId: string) =>
      secrets.filter((s) => s.connectionId === connectionId),
    setConnectionSecret: async (input: SetConnectionSecretInput) => {
      const entry: ConnectionSecret = {
        id: crypto.randomUUID(),
        connectionId: input.connectionId,
        kind: input.kind,
        credentialRef: crypto.randomUUID(),
        createdAt: now(),
        updatedAt: now()
      }
      secrets = [
        ...secrets.filter((s) => !(s.connectionId === input.connectionId && s.kind === input.kind)),
        entry
      ]
      return entry
    },
    deleteConnectionSecret: async (connectionId: string, kind: string) => {
      secrets = secrets.filter((s) => !(s.connectionId === connectionId && s.kind === kind))
    },
    onRunEvent: (listener: RunListener) => {
      listeners.add(listener)
      for (const [runId, events] of eventHistory) {
        for (const event of events) {
          listener({ runId, event })
        }
      }
      return () => listeners.delete(listener)
    }
  }
}

function createFtpInventory() {
  const ts = now()
  const client: Client = {
    id: FTP_CLIENT_ID,
    name: 'E2E Client',
    notes: null,
    color: null,
    createdAt: ts,
    updatedAt: ts
  }
  const environment: Environment = {
    id: FTP_ENV_ID,
    clientId: FTP_CLIENT_ID,
    name: 'lab',
    notes: null,
    color: '#22c55e',
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts
  }
  const group: Group = {
    id: FTP_GROUP_ID,
    environmentId: FTP_ENV_ID,
    name: 'ftp-group',
    notes: null,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts
  }
  const connection: Connection = {
    id: FTP_CONNECTION_ID,
    groupId: FTP_GROUP_ID,
    name: 'ftp-files',
    description: null,
    protocol: 'ftp',
    host: 'ftp.example.test',
    port: 21,
    username: 'ftpuser',
    authMethod: 'password',
    credentialRef: crypto.randomUUID(),
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
    createdAt: ts,
    updatedAt: ts
  }
  return { client, environment, group, connection }
}

type FsNode =
  | { type: 'dir'; name: string; children: Map<string, FsNode> }
  | { type: 'file'; name: string; size: number; modifiedAt: string }

function createInMemoryFs() {
  const root: FsNode = {
    type: 'dir',
    name: '',
    children: new Map([
      [
        'docs',
        {
          type: 'dir',
          name: 'docs',
          children: new Map([
            ['readme.txt', { type: 'file', name: 'readme.txt', size: 12, modifiedAt: now() }]
          ])
        }
      ],
      ['hello.txt', { type: 'file', name: 'hello.txt', size: 5, modifiedAt: now() }]
    ])
  }

  function splitPath(path: string): string[] {
    return path.split('/').filter(Boolean)
  }

  function resolveDir(path: string): Extract<FsNode, { type: 'dir' }> {
    const parts = splitPath(path)
    let node: FsNode = root
    for (const part of parts) {
      if (node.type !== 'dir') throw new Error(`Not a directory: ${path}`)
      const next = node.children.get(part)
      if (!next) throw new Error(`Path not found: ${path}`)
      node = next
    }
    if (node.type !== 'dir') throw new Error(`Not a directory: ${path}`)
    return node
  }

  function parentAndName(path: string): {
    parent: Extract<FsNode, { type: 'dir' }>
    name: string
  } {
    const parts = splitPath(path)
    const name = parts.pop()
    if (!name) throw new Error(`Invalid path: ${path}`)
    const parentPath = parts.length === 0 ? '/' : `/${parts.join('/')}`
    return { parent: resolveDir(parentPath), name }
  }

  function toEntry(parentPath: string, node: FsNode): RemoteEntry {
    const path =
      parentPath === '/' ? `/${node.name}` : `${parentPath.replace(/\/$/, '')}/${node.name}`
    return {
      name: node.name,
      path,
      type: node.type === 'dir' ? 'dir' : 'file',
      size: node.type === 'file' ? node.size : 0,
      modifiedAt: node.type === 'file' ? node.modifiedAt : null
    }
  }

  return {
    list(path: string): RemoteEntry[] {
      const normalized = path === '' ? '/' : path
      const dir = resolveDir(normalized)
      return [...dir.children.values()].map((child) => toEntry(normalized, child))
    },
    mkdir(path: string): void {
      const { parent, name } = parentAndName(path)
      if (parent.children.has(name)) throw new Error(`Already exists: ${path}`)
      parent.children.set(name, { type: 'dir', name, children: new Map() })
    },
    writeFile(path: string, size = 0): void {
      const { parent, name } = parentAndName(path)
      parent.children.set(name, { type: 'file', name, size, modifiedAt: now() })
    },
    rename(from: string, to: string): void {
      const { parent: fromParent, name: fromName } = parentAndName(from)
      const node = fromParent.children.get(fromName)
      if (!node) throw new Error(`Path not found: ${from}`)
      const { parent: toParent, name: toName } = parentAndName(to)
      if (toParent.children.has(toName)) throw new Error(`Already exists: ${to}`)
      fromParent.children.delete(fromName)
      const renamed = node.type === 'dir' ? { ...node, name: toName } : { ...node, name: toName }
      toParent.children.set(toName, renamed)
    },
    remove(path: string): void {
      const { parent, name } = parentAndName(path)
      if (!parent.children.has(name)) throw new Error(`Path not found: ${path}`)
      parent.children.delete(name)
    }
  }
}

export function installMockNorth(opts?: {
  failSecondStep?: boolean
  failFirstStep?: boolean
  scenario?: 'workflows' | 'ftp' | 'database'
  fsFail?: boolean
}): void {
  workflows = []
  variables = []
  runs = []
  secrets = []
  listeners.clear()
  eventHistory.clear()
  activePauses.clear()

  const runScenario = opts?.failFirstStep
    ? 'fail-first'
    : opts?.failSecondStep
      ? 'fail-ask'
      : 'success'

  const workflowsApi = createWorkflowsApi(runScenario)

  if (opts?.scenario === 'database') {
    installDatabaseMock()
    return
  }

  if (opts?.scenario !== 'ftp') {
    const ts = now()
    const api = {
      getVersion: async () => '0.0.0-e2e',
      getIdentity: async () => ({ osUsername: 'e2e-user' }),
      clients: {
        list: async () => [
          {
            id: CLIENT_ID,
            name: 'Cliente A',
            notes: null,
            color: null,
            createdAt: ts,
            updatedAt: ts
          },
          {
            id: CLIENT_B_ID,
            name: 'Cliente B',
            notes: null,
            color: null,
            createdAt: ts,
            updatedAt: ts
          }
        ],
        get: async (id: string) =>
          id === CLIENT_ID || id === CLIENT_B_ID
            ? {
                id,
                name: id === CLIENT_ID ? 'Cliente A' : 'Cliente B',
                notes: null,
                color: null,
                createdAt: ts,
                updatedAt: ts
              }
            : null,
        create: async () => {
          throw new Error('not implemented')
        },
        update: async () => {
          throw new Error('not implemented')
        },
        delete: async () => undefined
      },
      environments: {
        list: async () => [
          {
            id: ENV_ID,
            clientId: CLIENT_ID,
            name: 'Prod',
            notes: null,
            color: null,
            sortOrder: 0,
            createdAt: ts,
            updatedAt: ts
          },
          {
            id: ENV_B_ID,
            clientId: CLIENT_B_ID,
            name: 'Prod',
            notes: null,
            color: null,
            sortOrder: 0,
            createdAt: ts,
            updatedAt: ts
          }
        ],
        get: async () => null,
        create: async () => {
          throw new Error('not implemented')
        },
        update: async () => {
          throw new Error('not implemented')
        },
        delete: async () => undefined
      },
      groups: {
        list: async () => [
          {
            id: GROUP_ID,
            environmentId: ENV_ID,
            name: 'App',
            notes: null,
            sortOrder: 0,
            createdAt: ts,
            updatedAt: ts
          },
          {
            id: GROUP_B_ID,
            environmentId: ENV_B_ID,
            name: 'App',
            notes: null,
            sortOrder: 0,
            createdAt: ts,
            updatedAt: ts
          }
        ],
        get: async (id: string) =>
          id === GROUP_ID || id === GROUP_B_ID
            ? {
                id,
                environmentId: id === GROUP_ID ? ENV_ID : ENV_B_ID,
                name: 'App',
                notes: null,
                sortOrder: 0,
                createdAt: ts,
                updatedAt: ts
              }
            : null,
        create: async () => {
          throw new Error('not implemented')
        },
        update: async () => {
          throw new Error('not implemented')
        },
        delete: async () => undefined
      },
      workflows: workflowsApi
    }
    ;(window as unknown as { north: typeof api }).north = api
    return
  }

  const inventory = createFtpInventory()
  const fsStore = createInMemoryFs()
  const progressListeners = new Set<ProgressListener>()
  const openSessions = new Map<string, SessionDescriptor>()

  const api = {
    getVersion: async () => '0.0.0-e2e',
    getIdentity: async () => ({ osUsername: 'e2e-user' }),
    clients: {
      list: async () => [inventory.client],
      get: async (id: string) => (id === inventory.client.id ? inventory.client : null),
      create: async () => {
        throw new Error('not implemented in ftp harness')
      },
      update: async () => {
        throw new Error('not implemented in ftp harness')
      },
      delete: async () => undefined
    },
    environments: {
      list: async () => [inventory.environment],
      get: async (id: string) => (id === inventory.environment.id ? inventory.environment : null),
      create: async () => {
        throw new Error('not implemented in ftp harness')
      },
      update: async () => {
        throw new Error('not implemented in ftp harness')
      },
      delete: async () => undefined
    },
    groups: {
      list: async () => [inventory.group],
      get: async (id: string) => (id === inventory.group.id ? inventory.group : null),
      create: async () => {
        throw new Error('not implemented in ftp harness')
      },
      update: async () => {
        throw new Error('not implemented in ftp harness')
      },
      delete: async () => undefined
    },
    connections: {
      list: async () => [inventory.connection],
      get: async (id: string) => (id === inventory.connection.id ? inventory.connection : null),
      create: async () => {
        throw new Error('not implemented in ftp harness')
      },
      update: async (id: string, input: Partial<Connection>) => {
        if (id !== inventory.connection.id) throw new Error('not found')
        Object.assign(inventory.connection, input, { updatedAt: now() })
        return inventory.connection
      },
      delete: async () => undefined,
      toggleFavorite: async (id: string) => {
        if (id !== inventory.connection.id) throw new Error('not found')
        inventory.connection.isFavorite = !inventory.connection.isFavorite
        return inventory.connection
      },
      duplicate: async () => {
        throw new Error('not implemented in ftp harness')
      }
    },
    tags: {
      list: async () => [],
      create: async () => {
        throw new Error('not implemented in ftp harness')
      },
      update: async () => {
        throw new Error('not implemented in ftp harness')
      },
      delete: async () => undefined,
      setForConnection: async () => [],
      listForConnection: async () => [],
      setForAccess: async () => [],
      listForAccess: async () => []
    },
    vault: {
      setSecret: async () => crypto.randomUUID(),
      deleteSecret: async () => undefined,
      hasSecret: async () => true,
      isAvailable: async () => true,
      revealSecret: async () => 'secret'
    },
    search: {
      index: async () => []
    },
    sessions: {
      open: async (
        connectionId: string,
        onPort: (port: MessagePort) => void
      ): Promise<SessionDescriptor> => {
        if (connectionId !== FTP_CONNECTION_ID) {
          throw new Error('Connection not found')
        }
        const channel = new MessageChannel()
        onPort(channel.port2)
        channel.port1.start()
        const session: SessionDescriptor = {
          id: crypto.randomUUID(),
          connectionId: FTP_CONNECTION_ID,
          kind: 'file-transfer',
          protocol: 'ftp',
          title: inventory.connection.name,
          state: 'connected',
          errorMessage: null
        }
        openSessions.set(session.id, session)
        return session
      },
      close: async (sessionId: string) => {
        openSessions.delete(sessionId)
      },
      list: async () => [...openSessions.values()],
      respondHostKey: async () => undefined,
      write: () => undefined,
      resize: () => undefined,
      ready: () => undefined,
      onStdout: () => () => undefined,
      onStateChanged: () => () => undefined,
      onHostKeyPrompt: () => () => undefined
    },
    fs: {
      list: async (input: { sessionId: string; path: string }) => {
        const fail =
          opts?.fsFail || new URLSearchParams(window.location.search).get('fsFail') === '1'
        if (fail) {
          throw new Error('Falha ao listar diretório: mock fs fail')
        }
        if (!openSessions.has(input.sessionId)) {
          throw new Error('Sessão FTP encerrada')
        }
        return fsStore.list(input.path)
      },
      mkdir: async (input: { sessionId: string; path: string }) => {
        fsStore.mkdir(input.path)
      },
      rename: async (input: { sessionId: string; from: string; to: string }) => {
        fsStore.rename(input.from, input.to)
      },
      delete: async (input: { sessionId: string; path: string }) => {
        fsStore.remove(input.path)
      },
      download: async (input: { sessionId: string; remotePath: string }) => {
        const transferId = crypto.randomUUID()
        window.setTimeout(() => {
          const progress: TransferProgress = {
            transferId,
            sessionId: input.sessionId,
            direction: 'download',
            remotePath: input.remotePath,
            bytesTransferred: 5,
            totalBytes: 5,
            done: true,
            error: null
          }
          for (const listener of progressListeners) listener(progress)
        }, 10)
        return { transferId }
      },
      upload: async (input: { sessionId: string; localPath: string; remotePath: string }) => {
        fsStore.writeFile(input.remotePath, 5)
        const transferId = crypto.randomUUID()
        window.setTimeout(() => {
          const progress: TransferProgress = {
            transferId,
            sessionId: input.sessionId,
            direction: 'upload',
            remotePath: input.remotePath,
            bytesTransferred: 5,
            totalBytes: 5,
            done: true,
            error: null
          }
          for (const listener of progressListeners) listener(progress)
        }, 10)
        return { transferId }
      },
      onProgress: (listener: ProgressListener) => {
        progressListeners.add(listener)
        return () => progressListeners.delete(listener)
      },
      getPathForFile: (file: File) => `/tmp/e2e/${file.name}`
    },
    workflows: workflowsApi
  }

  ;(window as unknown as { north: typeof api }).north = api
}

function installDatabaseMock(): void {
  const ts = now()
  const client: Client = {
    id: DB_CLIENT_ID,
    name: 'E2E Client',
    notes: null,
    color: null,
    createdAt: ts,
    updatedAt: ts
  }
  const environment: Environment = {
    id: DB_ENV_ID,
    clientId: DB_CLIENT_ID,
    name: 'lab',
    notes: null,
    color: '#22c55e',
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts
  }
  const group: Group = {
    id: DB_GROUP_ID,
    environmentId: DB_ENV_ID,
    name: 'db-group',
    notes: null,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts
  }
  const access: Access = {
    id: DB_ACCESS_ID,
    groupId: DB_GROUP_ID,
    type: 'database',
    name: 'PostgreSQL · wms',
    description: null,
    notes: null,
    username: 'wms',
    credentialRef: crypto.randomUUID(),
    url: null,
    links: [],
    icon: null,
    color: null,
    isFavorite: false,
    engine: 'postgres',
    host: '10.1.1.17',
    port: 5432,
    database: 'wms',
    ssl: false,
    createdAt: ts,
    updatedAt: ts
  }
  const openSessions = new Map<string, SessionDescriptor>()

  const api = {
    getVersion: async () => '0.0.0-e2e',
    getIdentity: async () => ({ osUsername: 'e2e-user' }),
    clients: {
      list: async () => [client],
      get: async (id: string) => (id === client.id ? client : null),
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined
    },
    environments: {
      list: async () => [environment],
      get: async (id: string) => (id === environment.id ? environment : null),
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined
    },
    groups: {
      list: async () => [group],
      get: async (id: string) => (id === group.id ? group : null),
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined
    },
    connections: {
      list: async () => [],
      get: async () => null,
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      toggleFavorite: async () => {
        throw new Error('not implemented')
      },
      duplicate: async () => {
        throw new Error('not implemented')
      }
    },
    accesses: {
      list: async () => [access],
      get: async (id: string) => (id === access.id ? access : null),
      create: async () => access,
      update: async () => access,
      delete: async () => undefined,
      toggleFavorite: async (id: string) => {
        if (id === access.id) access.isFavorite = !access.isFavorite
        return access
      }
    },
    tags: {
      list: async () => [],
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      setForConnection: async () => [],
      listForConnection: async () => [],
      setForAccess: async () => [],
      listForAccess: async () => []
    },
    vault: {
      setSecret: async () => crypto.randomUUID(),
      deleteSecret: async () => undefined,
      hasSecret: async () => true,
      isAvailable: async () => true,
      revealSecret: async () => 'secret'
    },
    search: {
      index: async () => []
    },
    sessions: {
      open: async () => {
        throw new Error('use openAccess')
      },
      openAccess: async (accessId: string): Promise<SessionDescriptor> => {
        if (accessId !== DB_ACCESS_ID) throw new Error('Access not found')
        const session: SessionDescriptor = {
          id: crypto.randomUUID(),
          connectionId: null,
          accessId: DB_ACCESS_ID,
          kind: 'database',
          protocol: 'postgres',
          title: access.name,
          state: 'connected',
          errorMessage: null
        }
        openSessions.set(session.id, session)
        return session
      },
      close: async (sessionId: string) => {
        openSessions.delete(sessionId)
      },
      list: async () => [...openSessions.values()],
      respondHostKey: async () => undefined,
      write: () => undefined,
      resize: () => undefined,
      ready: () => undefined,
      onStdout: () => () => undefined,
      onStateChanged: () => () => undefined,
      onHostKeyPrompt: () => () => undefined
    },
    db: {
      test: async () => ({ ok: true, latencyMs: 12 }),
      introspect: async () => ({
        schemas: [
          {
            name: 'public',
            tables: [
              {
                name: 'orders',
                type: 'table' as const,
                columns: [
                  { name: 'id', dataType: 'integer', nullable: false, primaryKey: true },
                  { name: 'sku', dataType: 'text', nullable: true, primaryKey: false }
                ]
              }
            ]
          }
        ]
      }),
      query: async (input: { sessionId: string; sql: string }) => {
        if (/orders/i.test(input.sql)) {
          return {
            columns: [
              { name: 'id', dataType: 'integer' },
              { name: 'sku', dataType: 'text' }
            ],
            rows: [
              { id: 1, sku: 'ABC' },
              { id: 2, sku: 'DEF' }
            ],
            rowCount: 2,
            affectedRows: null,
            durationMs: 4,
            truncated: false
          }
        }
        return {
          columns: [{ name: 'ok' }],
          rows: [{ ok: 1 }],
          rowCount: 1,
          affectedRows: null,
          durationMs: 4,
          truncated: false
        }
      },
      cancel: async () => undefined,
      txState: async () => ({ autoCommit: true, inTransaction: false }),
      setAutoCommit: async (input: { sessionId: string; autoCommit: boolean }) => ({
        autoCommit: input.autoCommit,
        inTransaction: false
      }),
      commit: async () => ({ autoCommit: false, inTransaction: false }),
      rollback: async () => ({ autoCommit: false, inTransaction: false }),
      pickFile: async () => null
    }
  }

  ;(window as unknown as { north: typeof api }).north = api
}

export const harnessIds = {
  GROUP_ID,
  GROUP_B_ID,
  CONNECTION_ID,
  FTP_CONNECTION_ID,
  FTP_GROUP_ID,
  DB_ACCESS_ID
}
