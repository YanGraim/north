import type {
  Access,
  Client,
  Connection,
  Environment,
  Group,
  SearchIndexItem,
  Tag
} from '@shared/types'
import type { Repositories } from '../repositories'

export function buildSearchIndex(repos: Repositories): SearchIndexItem[] {
  const clients = repos.clients.list()
  const environments = repos.environments.list()
  const groups = repos.groups.list()
  const connections = repos.connections.list()
  const accesses = repos.accesses.list()
  const tags = repos.tags.list()

  const clientsById = new Map(clients.map((c) => [c.id, c]))
  const envsById = new Map(environments.map((e) => [e.id, e]))
  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const tagsById = new Map(tags.map((t) => [t.id, t]))

  const items: SearchIndexItem[] = []

  for (const client of clients) {
    items.push(clientItem(client))
  }

  for (const environment of environments) {
    const client = clientsById.get(environment.clientId) ?? null
    items.push(environmentItem(environment, client))
  }

  for (const group of groups) {
    const environment = envsById.get(group.environmentId) ?? null
    const client = environment ? (clientsById.get(environment.clientId) ?? null) : null
    items.push(groupItem(group, environment, client))
  }

  for (const tag of tags) {
    items.push(tagItem(tag))
  }

  for (const connection of connections) {
    const group = groupsById.get(connection.groupId) ?? null
    const environment = group ? (envsById.get(group.environmentId) ?? null) : null
    const client = environment ? (clientsById.get(environment.clientId) ?? null) : null
    const connectionTags = repos.tags.listForConnection(connection.id)
    const tagNames = connectionTags
      .map((t) => tagsById.get(t.id)?.name ?? t.name)
      .filter(Boolean)
      .join(' ')

    items.push(connectionItem(connection, client, environment, group, tagNames))
  }

  for (const access of accesses) {
    const group = groupsById.get(access.groupId) ?? null
    const environment = group ? (envsById.get(group.environmentId) ?? null) : null
    const client = environment ? (clientsById.get(environment.clientId) ?? null) : null
    const accessTags = repos.tags.listForAccess(access.id)
    const tagNames = accessTags
      .map((t) => tagsById.get(t.id)?.name ?? t.name)
      .filter(Boolean)
      .join(' ')

    items.push(accessItem(access, client, environment, group, tagNames))
  }

  return items
}

function emptySearchFields(): Pick<
  SearchIndexItem,
  'username' | 'url' | 'database' | 'accessType' | 'accessId'
> {
  return {
    username: null,
    url: null,
    database: null,
    accessType: null,
    accessId: null
  }
}

function clientItem(client: Client): SearchIndexItem {
  return {
    id: client.id,
    kind: 'client',
    title: client.name,
    subtitle: null,
    name: client.name,
    host: null,
    description: null,
    notes: client.notes,
    owner: null,
    clientName: client.name,
    environmentName: null,
    groupName: null,
    tags: null,
    ...emptySearchFields(),
    clientId: client.id,
    environmentId: null,
    groupId: null,
    connectionId: null,
    tagId: null,
    isFavorite: false,
    lastConnectedAt: null,
    protocol: null
  }
}

function environmentItem(environment: Environment, client: Client | null): SearchIndexItem {
  return {
    id: environment.id,
    kind: 'environment',
    title: environment.name,
    subtitle: client?.name ?? null,
    name: environment.name,
    host: null,
    description: null,
    notes: environment.notes,
    owner: null,
    clientName: client?.name ?? null,
    environmentName: environment.name,
    groupName: null,
    tags: null,
    ...emptySearchFields(),
    clientId: environment.clientId,
    environmentId: environment.id,
    groupId: null,
    connectionId: null,
    tagId: null,
    isFavorite: false,
    lastConnectedAt: null,
    protocol: null
  }
}

function groupItem(
  group: Group,
  environment: Environment | null,
  client: Client | null
): SearchIndexItem {
  const crumbs = [client?.name, environment?.name].filter(Boolean).join(' / ')
  return {
    id: group.id,
    kind: 'group',
    title: group.name,
    subtitle: crumbs || null,
    name: group.name,
    host: null,
    description: null,
    notes: group.notes,
    owner: null,
    clientName: client?.name ?? null,
    environmentName: environment?.name ?? null,
    groupName: group.name,
    tags: null,
    ...emptySearchFields(),
    clientId: client?.id ?? null,
    environmentId: group.environmentId,
    groupId: group.id,
    connectionId: null,
    tagId: null,
    isFavorite: false,
    lastConnectedAt: null,
    protocol: null
  }
}

function tagItem(tag: Tag): SearchIndexItem {
  return {
    id: tag.id,
    kind: 'tag',
    title: tag.name,
    subtitle: null,
    name: tag.name,
    host: null,
    description: null,
    notes: null,
    owner: null,
    clientName: null,
    environmentName: null,
    groupName: null,
    tags: tag.name,
    ...emptySearchFields(),
    clientId: null,
    environmentId: null,
    groupId: null,
    connectionId: null,
    tagId: tag.id,
    isFavorite: false,
    lastConnectedAt: null,
    protocol: null
  }
}

function connectionItem(
  connection: Connection,
  client: Client | null,
  environment: Environment | null,
  group: Group | null,
  tagNames: string
): SearchIndexItem {
  const crumbs = [client?.name, environment?.name, group?.name].filter(Boolean).join(' / ')
  return {
    id: connection.id,
    kind: 'connection',
    title: connection.name,
    subtitle: crumbs || `${connection.host}:${connection.port}`,
    name: connection.name,
    host: connection.host,
    description: connection.description,
    notes: connection.notes,
    owner: connection.owner,
    clientName: client?.name ?? null,
    environmentName: environment?.name ?? null,
    groupName: group?.name ?? null,
    tags: tagNames || null,
    username: connection.username,
    url: null,
    database: null,
    accessType: null,
    accessId: null,
    clientId: client?.id ?? null,
    environmentId: environment?.id ?? null,
    groupId: connection.groupId,
    connectionId: connection.id,
    tagId: null,
    isFavorite: connection.isFavorite,
    lastConnectedAt: connection.lastConnectedAt,
    protocol: connection.protocol
  }
}

function accessItem(
  access: Access,
  client: Client | null,
  environment: Environment | null,
  group: Group | null,
  tagNames: string
): SearchIndexItem {
  const crumbs = [client?.name, environment?.name, group?.name].filter(Boolean).join(' / ')
  const subtitleParts = [
    crumbs || null,
    access.host ? `${access.host}${access.port ? `:${access.port}` : ''}` : null,
    access.url
  ].filter(Boolean)

  return {
    id: access.id,
    kind: 'access',
    title: access.name,
    subtitle: subtitleParts.join(' · ') || null,
    name: access.name,
    host: access.host,
    description: access.description,
    notes: access.notes,
    owner: null,
    clientName: client?.name ?? null,
    environmentName: environment?.name ?? null,
    groupName: group?.name ?? null,
    tags: tagNames || null,
    username: access.username,
    url: access.url,
    database: access.database,
    accessType: access.type,
    accessId: access.id,
    clientId: client?.id ?? null,
    environmentId: environment?.id ?? null,
    groupId: access.groupId,
    connectionId: null,
    tagId: null,
    isFavorite: access.isFavorite,
    lastConnectedAt: null,
    protocol: null
  }
}
