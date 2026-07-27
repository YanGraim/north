import type {
  Client,
  Connection,
  ConnectionHistoryEntry,
  CreateClientInput,
  CreateConnectionInput,
  CreateEnvironmentInput,
  CreateGroupInput,
  CreateTagInput,
  Environment,
  Group,
  ListConnectionsFilter,
  ListHistoryFilter,
  RecordConnectionInput,
  SetConnectionTagsInput,
  Tag,
  UpdateClientInput,
  UpdateConnectionInput,
  UpdateEnvironmentInput,
  UpdateGroupInput,
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

  [IpcChannels.HISTORY_LIST]: {
    args: [filter?: ListHistoryFilter]
    result: ConnectionHistoryEntry[]
  }
  [IpcChannels.HISTORY_RECORD]: {
    args: [input: RecordConnectionInput]
    result: ConnectionHistoryEntry
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
  tags: {
    list: () => Promise<Tag[]>
    create: (input: CreateTagInput) => Promise<Tag>
    update: (id: string, input: UpdateTagInput) => Promise<Tag>
    delete: (id: string) => Promise<void>
    setForConnection: (input: SetConnectionTagsInput) => Promise<Tag[]>
    listForConnection: (connectionId: string) => Promise<Tag[]>
  }
  history: {
    list: (filter?: ListHistoryFilter) => Promise<ConnectionHistoryEntry[]>
    record: (input: RecordConnectionInput) => Promise<ConnectionHistoryEntry>
  }
}
