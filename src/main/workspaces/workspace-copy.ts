import type {
  Access,
  Connection,
  CopyTargetTree,
  CopyToWorkspaceInput,
  CopyToWorkspaceReport
} from '@shared/types'
import { cloneWorkflowDefinition } from '@shared/types'
import type { Repositories } from '../repositories'
import type { InventoryStore } from './inventory-store'
import { VPN_NOT_SHAREABLE } from './organization-vpns'
import type { SecretStore } from './secret-store'
import type { WorkflowStore } from './workflow-store'

/** Which VPN a client or environment brings up, in this computer's profile ids. */
export type VpnLinkSide = {
  get(target: 'client' | 'environment', id: string): Promise<string | null>
  set(target: 'client' | 'environment', id: string, profileId: string | null): Promise<void>
  /** A VPN from the other workspace, as one of this workspace's own (copied when needed). */
  adopt?(profileId: string): string | null
}

/** One side of a copy: a workspace's tree and passwords. */
export type CopySide = {
  inventory: InventoryStore
  secrets: SecretStore
  /** Personal workspace only: what an organization cannot hold yet (API collections). */
  repositories: Repositories | null
  /** Workflows and group variables go along with their group (REC-024). */
  workflows?: WorkflowStore
  vpnLinks?: VpnLinkSide
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
    created: {
      clients: 0,
      environments: 0,
      groups: 0,
      connections: 0,
      accesses: 0,
      workflows: 0
    },
    passwordsCopied: 0,
    warnings: [],
    root: { kind: input.kind, id: '' }
  }
  const tagIds = new Map<string, string>()
  const copiedConnections = new Map<string, string>()
  const pendingJumps: { copyId: string; sourceJumpId: string; name: string }[] = []
  let notCopiedApis = 0
  const toOrganization = !target.repositories

  const adoptVpn = (profileId: string | null): string | null =>
    profileId && target.vpnLinks?.adopt ? target.vpnLinks.adopt(profileId) : profileId

  /** The VPN link of a client or environment goes along; a VPN that can't be shared stays behind. */
  const copyVpnLink = async (kind: 'client' | 'environment', from: string, to: string) => {
    if (!source.vpnLinks || !target.vpnLinks) return
    const profileId = await source.vpnLinks.get(kind, from)
    if (!profileId) return
    try {
      await target.vpnLinks.set(kind, to, profileId)
    } catch (error) {
      report.warnings.push(`VPN não copiada (${message(error)})`)
    }
  }

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

  const copyPassword = async (item: Pick<Connection, 'credentialRef' | 'name'>) => {
    if (!item.credentialRef || !input.includePasswords) return null
    let value: string
    try {
      value = await source.secrets.resolve(item.credentialRef, 'reveal')
    } catch (error) {
      report.warnings.push(`“${item.name}”: senha não copiada (${message(error)})`)
      return null
    }
    const ref = await target.secrets.set(value)
    report.passwordsCopied += 1
    return ref
  }

  const copyConnection = async (connection: Connection, groupId: string, name: string) => {
    const credentialRef = await copyPassword(connection)
    const values: Parameters<InventoryStore['connections']['create']>[0] = {
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
      agentForward: connection.agentForward,
      jumpHostId: null,
      defaultCommand: connection.defaultCommand,
      startupDirectory: connection.startupDirectory,
      logFiles: connection.logFiles,
      notes: connection.notes,
      os: connection.os,
      icon: connection.icon,
      color: connection.color,
      owner: connection.owner,
      links: connection.links,
      vpnRequired: connection.vpnRequired,
      vpnMode: connection.vpnMode,
      vpnProfileId: adoptVpn(connection.vpnProfileId),
      checklist: connection.checklist,
      relatedFiles: connection.relatedFiles,
      isFavorite: false
    }
    let created: Connection
    try {
      created = await target.inventory.connections.create(values)
    } catch (error) {
      if (message(error) !== VPN_NOT_SHAREABLE) throw error
      report.warnings.push(`“${name}”: copiada sem VPN (OpenVPN fica só neste computador)`)
      created = await target.inventory.connections.create({
        ...values,
        vpnMode: values.vpnMode === 'profile' ? 'inherit' : values.vpnMode,
        vpnProfileId: null
      })
    }
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

  const copyAccess = async (access: Access, groupId: string) => {
    if (access.type === 'api' && toOrganization) {
      notCopiedApis += 1
      return
    }
    const credentialRef = await copyPassword(access)
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      groupId: _g,
      isFavorite: _f,
      credentialRef: _r,
      ...rest
    } = access
    let created: Access
    try {
      created = await target.inventory.accesses.create({
        ...rest,
        vpnProfileId: adoptVpn(rest.vpnProfileId),
        groupId,
        credentialRef,
        isFavorite: false
      })
    } catch (error) {
      // A VPN that cannot be shared must not cost the whole access.
      if (message(error) !== VPN_NOT_SHAREABLE) throw error
      report.warnings.push(`“${access.name}”: copiado sem VPN (OpenVPN fica só neste computador)`)
      created = await target.inventory.accesses.create({
        ...rest,
        groupId,
        credentialRef,
        isFavorite: false,
        vpnMode: rest.vpnMode === 'profile' ? 'inherit' : rest.vpnMode,
        vpnProfileId: null
      })
    }
    report.created.accesses += 1
    const tags = await source.inventory.tags.listForAccess(access.id)
    if (tags.length > 0) {
      const ids: string[] = []
      for (const tag of tags) ids.push(await targetTag(tag.name, tag.color))
      await target.inventory.tags.setForAccess({ accessId: created.id, tagIds: ids })
    }
  }

  /** A group's variables and workflows; the preferred connection follows when it came along. */
  const copyWorkflows = async (fromGroupId: string, toGroupId: string) => {
    if (!source.workflows || !target.workflows) return
    for (const variable of await source.workflows.variables.listByGroup(fromGroupId)) {
      await target.workflows.variables.create({
        groupId: toGroupId,
        key: variable.key,
        value: variable.value,
        description: variable.description
      })
    }
    for (const workflow of await source.workflows.workflows.listByGroup(fromGroupId)) {
      await target.workflows.workflows.create({
        groupId: toGroupId,
        name: workflow.name,
        description: workflow.description,
        icon: workflow.icon,
        sortOrder: workflow.sortOrder,
        preferredConnectionId: workflow.preferredConnectionId
          ? (copiedConnections.get(workflow.preferredConnectionId) ?? null)
          : null,
        definition: cloneWorkflowDefinition(workflow.definition)
      })
      report.created.workflows += 1
    }
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
    for (const access of await source.inventory.accesses.list({ groupId })) {
      await copyAccess(access, created.id)
    }
    await copyWorkflows(groupId, created.id)
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
    await copyVpnLink('environment', environment.id, created.id)
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
    await copyVpnLink('client', client.id, created.id)
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
  if (notCopiedApis > 0) {
    report.warnings.push(
      `${notCopiedApis} coleção(ões) de API ficaram de fora: a organização ainda não guarda APIs`
    )
  }
  return report
}
