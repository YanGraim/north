import type {
  FsDownloadInput,
  FsListInput,
  FsPathInput,
  FsRenameInput,
  FsUploadInput,
  HostKeyPrompt,
  HostKeyResponse,
  RemoteEntry,
  SessionDescriptor,
  SessionPortMessage,
  TransferHandle,
  TransferProgress
} from '../protocols'
import type {
  Access,
  Client,
  Connection,
  ConnectionHistoryEntry,
  CreateAccessInput,
  CreateClientInput,
  CreateConnectionInput,
  CreateEnvironmentInput,
  CreateGroupInput,
  CreateTagInput,
  Environment,
  Group,
  ImportReport,
  ListAccessesFilter,
  ListConnectionsFilter,
  ListHistoryFilter,
  RecordConnectionInput,
  RevealSecretInput,
  SearchIndexItem,
  SerialPortInfo,
  SetAccessTagsInput,
  SetConnectionTagsInput,
  SetSecretInput,
  StatsOverview,
  Tag,
  UpdateAccessInput,
  UpdateClientInput,
  UpdateConnectionInput,
  UpdateEnvironmentInput,
  UpdateGroupInput,
  UpdateStatus,
  UpdateTagInput
} from '../types'
import { IpcChannels } from './channels'

/**
 * Contrato tipado de invoke (request/response) entre renderer e main.
 * Adicione novos canais aqui; main, preload e hooks devem seguir este mapa.
 */
export interface IpcInvokeMap {
  [IpcChannels.APP_GET_VERSION]: {
    args: []
    result: string
  }

  [IpcChannels.CLIENTS_LIST]: { args: []; result: Client[] }
  [IpcChannels.CLIENTS_GET]: { args: [id: string]; result: Client | null }
  [IpcChannels.CLIENTS_CREATE]: { args: [input: CreateClientInput]; result: Client }
  [IpcChannels.CLIENTS_UPDATE]: {
    args: [id: string, input: UpdateClientInput]
    result: Client
  }
  [IpcChannels.CLIENTS_DELETE]: { args: [id: string]; result: undefined }

  [IpcChannels.ENVIRONMENTS_LIST]: {
    args: [clientId?: string]
    result: Environment[]
  }
  [IpcChannels.ENVIRONMENTS_GET]: { args: [id: string]; result: Environment | null }
  [IpcChannels.ENVIRONMENTS_CREATE]: {
    args: [input: CreateEnvironmentInput]
    result: Environment
  }
  [IpcChannels.ENVIRONMENTS_UPDATE]: {
    args: [id: string, input: UpdateEnvironmentInput]
    result: Environment
  }
  [IpcChannels.ENVIRONMENTS_DELETE]: { args: [id: string]; result: undefined }

  [IpcChannels.GROUPS_LIST]: { args: [environmentId?: string]; result: Group[] }
  [IpcChannels.GROUPS_GET]: { args: [id: string]; result: Group | null }
  [IpcChannels.GROUPS_CREATE]: { args: [input: CreateGroupInput]; result: Group }
  [IpcChannels.GROUPS_UPDATE]: {
    args: [id: string, input: UpdateGroupInput]
    result: Group
  }
  [IpcChannels.GROUPS_DELETE]: { args: [id: string]; result: undefined }

  [IpcChannels.CONNECTIONS_LIST]: {
    args: [filter?: ListConnectionsFilter]
    result: Connection[]
  }
  [IpcChannels.CONNECTIONS_GET]: { args: [id: string]; result: Connection | null }
  [IpcChannels.CONNECTIONS_CREATE]: {
    args: [input: CreateConnectionInput]
    result: Connection
  }
  [IpcChannels.CONNECTIONS_UPDATE]: {
    args: [id: string, input: UpdateConnectionInput]
    result: Connection
  }
  [IpcChannels.CONNECTIONS_DELETE]: { args: [id: string]; result: undefined }
  [IpcChannels.CONNECTIONS_TOGGLE_FAVORITE]: {
    args: [id: string]
    result: Connection
  }
  [IpcChannels.CONNECTIONS_DUPLICATE]: { args: [id: string]; result: Connection }

  [IpcChannels.ACCESSES_LIST]: {
    args: [filter?: ListAccessesFilter]
    result: Access[]
  }
  [IpcChannels.ACCESSES_GET]: { args: [id: string]; result: Access | null }
  [IpcChannels.ACCESSES_CREATE]: {
    args: [input: CreateAccessInput]
    result: Access
  }
  [IpcChannels.ACCESSES_UPDATE]: {
    args: [id: string, input: UpdateAccessInput]
    result: Access
  }
  [IpcChannels.ACCESSES_DELETE]: { args: [id: string]; result: undefined }
  [IpcChannels.ACCESSES_TOGGLE_FAVORITE]: {
    args: [id: string]
    result: Access
  }

  [IpcChannels.TAGS_LIST]: { args: []; result: Tag[] }
  [IpcChannels.TAGS_CREATE]: { args: [input: CreateTagInput]; result: Tag }
  [IpcChannels.TAGS_UPDATE]: { args: [id: string, input: UpdateTagInput]; result: Tag }
  [IpcChannels.TAGS_DELETE]: { args: [id: string]; result: undefined }
  [IpcChannels.TAGS_SET_FOR_CONNECTION]: {
    args: [input: SetConnectionTagsInput]
    result: Tag[]
  }
  [IpcChannels.TAGS_LIST_FOR_CONNECTION]: {
    args: [connectionId: string]
    result: Tag[]
  }
  [IpcChannels.TAGS_SET_FOR_ACCESS]: {
    args: [input: SetAccessTagsInput]
    result: Tag[]
  }
  [IpcChannels.TAGS_LIST_FOR_ACCESS]: {
    args: [accessId: string]
    result: Tag[]
  }

  [IpcChannels.HISTORY_LIST]: {
    args: [filter?: ListHistoryFilter]
    result: ConnectionHistoryEntry[]
  }
  [IpcChannels.HISTORY_RECORD]: {
    args: [input: RecordConnectionInput]
    result: ConnectionHistoryEntry
  }

  [IpcChannels.SEARCH_INDEX]: {
    args: []
    result: SearchIndexItem[]
  }

  [IpcChannels.VAULT_SET_SECRET]: {
    args: [input: SetSecretInput]
    result: string
  }
  [IpcChannels.VAULT_DELETE_SECRET]: {
    args: [credentialRef: string]
    result: undefined
  }
  [IpcChannels.VAULT_HAS_SECRET]: {
    args: [credentialRef: string]
    result: boolean
  }
  [IpcChannels.VAULT_IS_AVAILABLE]: {
    args: []
    result: boolean
  }
  [IpcChannels.VAULT_REVEAL_SECRET]: {
    args: [input: RevealSecretInput]
    result: string
  }

  [IpcChannels.SESSIONS_OPEN]: {
    args: [connectionId: string, requestId: string]
    result: SessionDescriptor
  }
  [IpcChannels.SESSIONS_CLOSE]: {
    args: [sessionId: string]
    result: undefined
  }
  [IpcChannels.SESSIONS_LIST]: {
    args: []
    result: SessionDescriptor[]
  }
  [IpcChannels.SESSIONS_RESPOND_HOST_KEY]: {
    args: [response: HostKeyResponse]
    result: undefined
  }

  [IpcChannels.FS_LIST]: {
    args: [input: FsListInput]
    result: RemoteEntry[]
  }
  [IpcChannels.FS_MKDIR]: {
    args: [input: FsPathInput]
    result: undefined
  }
  [IpcChannels.FS_RENAME]: {
    args: [input: FsRenameInput]
    result: undefined
  }
  [IpcChannels.FS_DELETE]: {
    args: [input: FsPathInput]
    result: undefined
  }
  [IpcChannels.FS_DOWNLOAD]: {
    args: [input: FsDownloadInput]
    result: TransferHandle
  }
  [IpcChannels.FS_UPLOAD]: {
    args: [input: FsUploadInput]
    result: TransferHandle
  }

  [IpcChannels.SERIAL_LIST_PORTS]: {
    args: []
    result: SerialPortInfo[]
  }

  [IpcChannels.STATS_OVERVIEW]: {
    args: []
    result: StatsOverview
  }

  [IpcChannels.INVENTORY_EXPORT]: {
    args: []
    result: { canceled: boolean; filePath: string | null }
  }
  [IpcChannels.INVENTORY_IMPORT]: {
    args: []
    result: { canceled: boolean; report: ImportReport | null }
  }
  [IpcChannels.INVENTORY_IMPORT_CSV]: {
    args: [options: { allowSecrets: boolean }]
    result: { canceled: boolean; report: ImportReport | null }
  }
  [IpcChannels.INVENTORY_DOWNLOAD_CSV_TEMPLATE]: {
    args: []
    result: { canceled: boolean; filePath: string | null }
  }

  [IpcChannels.UPDATES_CHECK]: {
    args: []
    result: UpdateStatus
  }
  [IpcChannels.UPDATES_INSTALL]: {
    args: []
    result: undefined
  }
  [IpcChannels.UPDATES_GET_STATUS]: {
    args: []
    result: UpdateStatus
  }
}

export type InvokeChannel = keyof IpcInvokeMap

export type InvokeArgs<C extends InvokeChannel> = IpcInvokeMap[C]['args']
export type InvokeResult<C extends InvokeChannel> = IpcInvokeMap[C]['result']

/** API tipada exposta ao renderer via contextBridge. */
export interface NorthApi {
  getVersion: () => Promise<string>
  clients: {
    list: () => Promise<Client[]>
    get: (id: string) => Promise<Client | null>
    create: (input: CreateClientInput) => Promise<Client>
    update: (id: string, input: UpdateClientInput) => Promise<Client>
    delete: (id: string) => Promise<void>
  }
  environments: {
    list: (clientId?: string) => Promise<Environment[]>
    get: (id: string) => Promise<Environment | null>
    create: (input: CreateEnvironmentInput) => Promise<Environment>
    update: (id: string, input: UpdateEnvironmentInput) => Promise<Environment>
    delete: (id: string) => Promise<void>
  }
  groups: {
    list: (environmentId?: string) => Promise<Group[]>
    get: (id: string) => Promise<Group | null>
    create: (input: CreateGroupInput) => Promise<Group>
    update: (id: string, input: UpdateGroupInput) => Promise<Group>
    delete: (id: string) => Promise<void>
  }
  connections: {
    list: (filter?: ListConnectionsFilter) => Promise<Connection[]>
    get: (id: string) => Promise<Connection | null>
    create: (input: CreateConnectionInput) => Promise<Connection>
    update: (id: string, input: UpdateConnectionInput) => Promise<Connection>
    delete: (id: string) => Promise<void>
    toggleFavorite: (id: string) => Promise<Connection>
    duplicate: (id: string) => Promise<Connection>
  }
  accesses: {
    list: (filter?: ListAccessesFilter) => Promise<Access[]>
    get: (id: string) => Promise<Access | null>
    create: (input: CreateAccessInput) => Promise<Access>
    update: (id: string, input: UpdateAccessInput) => Promise<Access>
    delete: (id: string) => Promise<void>
    toggleFavorite: (id: string) => Promise<Access>
  }
  tags: {
    list: () => Promise<Tag[]>
    create: (input: CreateTagInput) => Promise<Tag>
    update: (id: string, input: UpdateTagInput) => Promise<Tag>
    delete: (id: string) => Promise<void>
    setForConnection: (input: SetConnectionTagsInput) => Promise<Tag[]>
    listForConnection: (connectionId: string) => Promise<Tag[]>
    setForAccess: (input: SetAccessTagsInput) => Promise<Tag[]>
    listForAccess: (accessId: string) => Promise<Tag[]>
  }
  history: {
    list: (filter?: ListHistoryFilter) => Promise<ConnectionHistoryEntry[]>
    record: (input: RecordConnectionInput) => Promise<ConnectionHistoryEntry>
  }
  search: {
    index: () => Promise<SearchIndexItem[]>
  }
  vault: {
    setSecret: (input: SetSecretInput) => Promise<string>
    deleteSecret: (credentialRef: string) => Promise<void>
    hasSecret: (credentialRef: string) => Promise<boolean>
    isAvailable: () => Promise<boolean>
    revealSecret: (input: RevealSecretInput) => Promise<string>
  }
  sessions: {
    /**
     * Opens a session. The MessagePort MUST be received via `onPort` (argument to a
     * renderer callback) — returning MessagePort through contextBridge yields a dead port.
     */
    open: (connectionId: string, onPort: (port: MessagePort) => void) => Promise<SessionDescriptor>
    close: (sessionId: string) => Promise<void>
    list: () => Promise<SessionDescriptor[]>
    respondHostKey: (response: HostKeyResponse) => Promise<void>
    /** Terminal stdin (IPC — reliable under sandbox). */
    write: (sessionId: string, data: number[]) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    ready: (sessionId: string) => void
    onStdout: (
      listener: (payload: { sessionId: string; message: SessionPortMessage }) => void
    ) => () => void
    onStateChanged: (listener: (session: SessionDescriptor) => void) => () => void
    onHostKeyPrompt: (listener: (prompt: HostKeyPrompt) => void) => () => void
  }
  fs: {
    list: (input: FsListInput) => Promise<RemoteEntry[]>
    mkdir: (input: FsPathInput) => Promise<void>
    rename: (input: FsRenameInput) => Promise<void>
    delete: (input: FsPathInput) => Promise<void>
    download: (input: FsDownloadInput) => Promise<TransferHandle>
    upload: (input: FsUploadInput) => Promise<TransferHandle>
    onProgress: (listener: (progress: TransferProgress) => void) => () => void
    getPathForFile: (file: File) => string
  }
  serial: {
    listPorts: () => Promise<SerialPortInfo[]>
  }
  stats: {
    overview: () => Promise<StatsOverview>
  }
  inventory: {
    export: () => Promise<{ canceled: boolean; filePath: string | null }>
    import: () => Promise<{ canceled: boolean; report: ImportReport | null }>
    importCsv: (options: {
      allowSecrets: boolean
    }) => Promise<{ canceled: boolean; report: ImportReport | null }>
    downloadCsvTemplate: () => Promise<{ canceled: boolean; filePath: string | null }>
  }
  updates: {
    check: () => Promise<UpdateStatus>
    getStatus: () => Promise<UpdateStatus>
    install: () => Promise<void>
    onAvailable: (listener: (info: { version: string }) => void) => () => void
    onStatusChanged: (listener: (status: UpdateStatus) => void) => () => void
  }
}
