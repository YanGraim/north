import type {
  Connection,
  CopyTargetTree,
  CopyToWorkspaceInput,
  CopyToWorkspaceReport
} from '@shared/types'
import type { Repositories } from '../repositories'
import type { InventoryStore } from './inventory-store'
import type { SecretStore } from './secret-store'

/** One side of a copy: a workspace's tree and passwords. */
export type CopySide = {
  inventory: InventoryStore
  secrets: SecretStore
  /** Personal workspace only: what an organization cannot hold yet (accesses, workflows). */
  repositories: Repositories | null
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** "Web" → "Web (cópia)" → "Web (cópia 2)", so a copy never hides an existing item. */
function freeName(name: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  if (!used.has(name.toLowerCase())) return name
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${name} (cópia)` : `${name} (cópia ${n})`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/** Names the target workspace has where a copy may land. */
export async function copyTargets(target: InventoryStore): Promise<CopyTargetTree> {
  const [clients, environments, groups] = await Promise.all([
    target.clients.list(),
    target.environments.list(),
    target.groups.list()
  ])
  return {
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    environments: environments.map((e) => ({ id: e.id, name: e.name, clientId: e.clientId })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, environmentId: g.environmentId }))
  }
}

/**
 * Copies a client, environment, group or connection into another workspace
 * (ADR 0018 §4). The copy is new and unlinked: fresh ids, tags matched by
 * name, passwords re-encrypted by the target (the local vault or the North
 * Server) when asked. Reading a password from an organization is an audited
 * `reveal`, so someone who may only connect copies without it.
 */
export async function copyToWorkspace(
  source: CopySide,
  target: CopySide,
  input: CopyToWorkspaceInput
): Promise<CopyToWorkspaceReport> {
  const report: CopyToWorkspaceReport = {
    created: { clients: 0, environments: 0, groups: 0, connections: 0 },
    passwordsCopied: 0,
    warnings: [],
    root: { kind: input.kind, id: '' }
  }
  const tagIds = new Map<string, string>()
  const copiedConnections = new Map<string, string>()
  const pendingJumps: { copyId: string; sourceJumpId: string; name: string }[] = []
  let notCopiedAccesses = 0
  let notCopiedWorkflows = 0

  const targetTag = async (name: string, color: string | null): Promise<string> => {
    const key = name.toLowerCase()
    if (tagIds.size === 0) {
      for (const tag of await target.inventory.tags.list())
        tagIds.set(tag.name.toLowerCase(), tag.id)
    }
    let id = tagIds.get(key)
    if (!id) {
      id = (await target.inventory.tags.create({ name, color })).id
      tagIds.set(key, id)
    }
    return id
  }

  const copyPassword = async (connection: Connection): Promise<string | null> => {
    if (!connection.credentialRef || !input.includePasswords) return null
    let value: string
    try {
      value = await source.secrets.resolve(connection.credentialRef, 'reveal')
    } catch (error) {
      report.warnings.push(`“${connection.name}”: senha não copiada (${message(error)})`)
      return null
    }
    const ref = await target.secrets.set(value)
    report.passwordsCopied += 1
    return ref
  }

  const copyConnection = async (connection: Connection, groupId: string, name: string) => {
    const credentialRef = await copyPassword(connection)
    const created = await target.inventory.connections.create({
      groupId,
      name,
      description: connection.description,
      protocol: connection.protocol,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authMethod: connection.authMethod,
      credentialRef,
      // A key file path only means something on this computer.
      privateKeyPath: connection.privateKeyPath,
      jumpHostId: null,
      defaultCommand: connection.defaultCommand,
      notes: connection.notes,
      os: connection.os,
      icon: connection.icon,
      color: connection.color,
      owner: connection.owner,
      links: connection.links,
      vpnRequired: connection.vpnRequired,
      vpnMode: connection.vpnMode,
      vpnProfileId: connection.vpnProfileId,
      checklist: connection.checklist,
      relatedFiles: connection.relatedFiles,
      isFavorite: false
    })
    report.created.connections += 1
    copiedConnections.set(connection.id, created.id)
    if (connection.jumpHostId) {
      pendingJumps.push({
        copyId: created.id,
        sourceJumpId: connection.jumpHostId,
        name: connection.name
      })
    }
    const tags = await source.inventory.tags.listForConnection(connection.id)
    if (tags.length > 0) {
      const ids: string[] = []
      for (const tag of tags) ids.push(await targetTag(tag.name, tag.color))
      await target.inventory.tags.setForConnection({ connectionId: created.id, tagIds: ids })
    }
    return created
  }

  const copyGroup = async (groupId: string, environmentId: string, name?: string) => {
    const group = await source.inventory.groups.get(groupId)
    if (!group) throw new Error('Grupo não encontrado')
    const siblings = (await target.inventory.groups.list(environmentId)).map((g) => g.name)
    const created = await target.inventory.groups.create({
      environmentId,
      name: name ?? freeName(group.name, siblings),
      notes: group.notes,
      sortOrder: group.sortOrder
    })
    report.created.groups += 1
    for (const connection of await source.inventory.connections.list({ groupId })) {
      await copyConnection(connection, created.id, connection.name)
    }
    if (source.repositories && !target.repositories) {
      notCopiedAccesses += source.repositories.accesses.list({ groupId }).length
      notCopiedWorkflows += source.repositories.workflows.listByGroup(groupId).length
    }
    return created
  }

  const copyEnvironment = async (environmentId: string, clientId: string, name?: string) => {
    const environment = await source.inventory.environments.get(environmentId)
    if (!environment) throw new Error('Ambiente não encontrado')
    const siblings = (await target.inventory.environments.list(clientId)).map((e) => e.name)
    const created = await target.inventory.environments.create({
      clientId,
      name: name ?? freeName(environment.name, siblings),
      notes: environment.notes,
      color: environment.color,
      sortOrder: environment.sortOrder
    })
    report.created.environments += 1
    for (const group of await source.inventory.groups.list(environmentId)) {
      await copyGroup(group.id, created.id, group.name)
    }
    return created
  }

  const requireParent = () => {
    if (!input.targetParentId) throw new Error('Escolha onde colocar a cópia')
    return input.targetParentId
  }

  if (input.kind === 'client') {
    const client = await source.inventory.clients.get(input.id)
    if (!client) throw new Error('Cliente não encontrado')
    const siblings = (await target.inventory.clients.list()).map((c) => c.name)
    const created = await target.inventory.clients.create({
      name: freeName(client.name, siblings),
      notes: client.notes,
      color: client.color
    })
    report.created.clients += 1
    report.root.id = created.id
    for (const environment of await source.inventory.environments.list(client.id)) {
      await copyEnvironment(environment.id, created.id, environment.name)
    }
  } else if (input.kind === 'environment') {
    report.root.id = (await copyEnvironment(input.id, requireParent())).id
  } else if (input.kind === 'group') {
    report.root.id = (await copyGroup(input.id, requireParent())).id
  } else {
    const connection = await source.inventory.connections.get(input.id)
    if (!connection) throw new Error('Conexão não encontrada')
    const groupId = requireParent()
    const siblings = (await target.inventory.connections.list({ groupId })).map((c) => c.name)
    report.root.id = (
      await copyConnection(connection, groupId, freeName(connection.name, siblings))
    ).id
  }

  // Jump hosts follow only when they came along in the same copy.
  for (const jump of pendingJumps) {
    const copiedJump = copiedConnections.get(jump.sourceJumpId)
    if (copiedJump) {
      await target.inventory.connections.update(jump.copyId, { jumpHostId: copiedJump })
    } else {
      report.warnings.push(`“${jump.name}”: o jump host não veio junto; configure de novo`)
    }
  }
  if (notCopiedAccesses > 0) {
    report.warnings.push(
      `${notCopiedAccesses} acesso(s) de banco/login ficaram de fora: a organização ainda não guarda acessos`
    )
  }
  if (notCopiedWorkflows > 0) {
    report.warnings.push(
      `${notCopiedWorkflows} workflow(s) ficaram de fora: a organização ainda não guarda workflows`
    )
  }
  return report
}
