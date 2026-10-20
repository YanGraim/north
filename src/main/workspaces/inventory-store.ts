import type {
  Client,
  Connection,
  CreateClientInput,
  CreateConnectionInput,
  CreateEnvironmentInput,
  CreateGroupInput,
  CreateTagInput,
  Environment,
  Group,
  ListConnectionsFilter,
  SetAccessTagsInput,
  SetConnectionTagsInput,
  Tag,
  UpdateClientInput,
  UpdateConnectionInput,
  UpdateEnvironmentInput,
  UpdateGroupInput,
  UpdateTagInput
} from '@shared/types'
import type { Repositories } from '../repositories'

/**
 * The inventory tree as an async contract, so the same IPC handlers can read
 * SQLite (personal workspace) or a North Server (organization) — ADR 0018 §10.
 */
export interface InventoryStore {
  clients: {
    list(): Promise<Client[]>
    get(id: string): Promise<Client | null>
    create(input: CreateClientInput): Promise<Client>
    update(id: string, input: UpdateClientInput): Promise<Client | null>
    delete(id: string): Promise<boolean>
  }
  environments: {
    list(clientId?: string): Promise<Environment[]>
    get(id: string): Promise<Environment | null>
    create(input: CreateEnvironmentInput): Promise<Environment>
    update(id: string, input: UpdateEnvironmentInput): Promise<Environment | null>
    delete(id: string): Promise<boolean>
  }
  groups: {
    list(environmentId?: string): Promise<Group[]>
    get(id: string): Promise<Group | null>
    create(input: CreateGroupInput): Promise<Group>
    update(id: string, input: UpdateGroupInput): Promise<Group | null>
    delete(id: string): Promise<boolean>
  }
  connections: {
    list(filter?: ListConnectionsFilter): Promise<Connection[]>
    get(id: string): Promise<Connection | null>
    create(input: CreateConnectionInput): Promise<Connection>
    update(id: string, input: UpdateConnectionInput): Promise<Connection | null>
    delete(id: string): Promise<boolean>
    toggleFavorite(id: string): Promise<Connection | null>
    duplicate(id: string): Promise<Connection | null>
  }
  tags: {
    list(): Promise<Tag[]>
    create(input: CreateTagInput): Promise<Tag>
    update(id: string, input: UpdateTagInput): Promise<Tag | null>
    delete(id: string): Promise<boolean>
    setForConnection(input: SetConnectionTagsInput): Promise<Tag[]>
    listForConnection(connectionId: string): Promise<Tag[]>
    setForAccess(input: SetAccessTagsInput): Promise<Tag[]>
    listForAccess(accessId: string): Promise<Tag[]>
  }
}

type AsyncOf<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<R> : never
}

function lift<T extends object>(target: T): AsyncOf<T> {
  return new Proxy(target, {
    get(obj, key) {
      const value = Reflect.get(obj, key)
      return typeof value === 'function'
        ? async (...args: unknown[]) => value.apply(obj, args)
        : value
    }
  }) as unknown as AsyncOf<T>
}

/** SQLite repositories behind the async contract (results are identical). */
export function localInventoryStore(repos: Repositories): InventoryStore {
  return {
    clients: lift(repos.clients),
    environments: lift(repos.environments),
    groups: lift(repos.groups),
    connections: lift(repos.connections),
    tags: lift(repos.tags)
  } as unknown as InventoryStore
}
