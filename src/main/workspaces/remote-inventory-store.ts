import type {
  Client,
  Connection,
  Environment,
  Group,
  ListConnectionsFilter,
  Tag
} from '@shared/types'
import type { InventoryStore } from './inventory-store'
import type { OrganizationClient } from './organization-client'

export const ORGANIZATION_UNAVAILABLE =
  'Isso ainda não está disponível em organizações. Use o Meu workspace por enquanto.'

const v1 = '/api/v1'

function query(params: Record<string, string | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/** Organization inventory on the North Server. Missing entities come back as null/false, like SQLite. */
export class RemoteInventoryStore implements InventoryStore {
  constructor(private readonly api: OrganizationClient) {}

  private async orNull<T>(call: Promise<T>): Promise<T | null> {
    try {
      return await call
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null
      throw error
    }
  }

  private async deleted(path: string): Promise<boolean> {
    return (await this.orNull(this.api.request('DELETE', path).then(() => true))) ?? false
  }

  private crud<T, C, U>(resource: string) {
    return {
      get: (id: string) => this.orNull(this.api.request<T>('GET', `${v1}/${resource}/${id}`)),
      create: (input: C) => this.api.request<T>('POST', `${v1}/${resource}`, input),
      update: (id: string, input: U) =>
        this.orNull(this.api.request<T>('PATCH', `${v1}/${resource}/${id}`, input)),
      delete: (id: string) => this.deleted(`${v1}/${resource}/${id}`)
    }
  }

  readonly clients: InventoryStore['clients'] = {
    list: () => this.api.request<Client[]>('GET', `${v1}/clients`),
    ...this.crud('clients')
  }

  readonly environments: InventoryStore['environments'] = {
    list: (clientId) =>
      this.api.request<Environment[]>('GET', `${v1}/environments${query({ clientId })}`),
    ...this.crud('environments')
  }

  readonly groups: InventoryStore['groups'] = {
    list: (environmentId) =>
      this.api.request<Group[]>('GET', `${v1}/groups${query({ environmentId })}`),
    ...this.crud('groups')
  }

  readonly connections: InventoryStore['connections'] = {
    list: (filter: ListConnectionsFilter = {}) =>
      this.api.request<Connection[]>('GET', `${v1}/connections${query(filter)}`),
    ...this.crud('connections'),
    toggleFavorite: (id) =>
      this.orNull(this.api.request<Connection>('POST', `${v1}/connections/${id}/favorite`)),
    duplicate: (id) =>
      this.orNull(this.api.request<Connection>('POST', `${v1}/connections/${id}/duplicate`))
  }

  readonly tags: InventoryStore['tags'] = {
    list: () => this.api.request<Tag[]>('GET', `${v1}/tags`),
    create: (input) => this.api.request<Tag>('POST', `${v1}/tags`, input),
    update: (id, input) => this.orNull(this.api.request<Tag>('PATCH', `${v1}/tags/${id}`, input)),
    delete: (id) => this.deleted(`${v1}/tags/${id}`),
    setForConnection: (input) =>
      this.api.request<Tag[]>('PUT', `${v1}/connections/${input.connectionId}/tags`, {
        tagIds: input.tagIds
      }),
    listForConnection: (connectionId) =>
      this.api.request<Tag[]>('GET', `${v1}/connections/${connectionId}/tags`),
    // Accesses are not part of the organization inventory yet.
    setForAccess: async () => {
      throw new Error(ORGANIZATION_UNAVAILABLE)
    },
    listForAccess: async () => []
  }
}
