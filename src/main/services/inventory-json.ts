import {
  type ExportVpn,
  emptyImportReport,
  type ImportReport,
  type InventoryExport,
  type VpnMode,
  type VpnProfile
} from '@shared/types'
import type { Repositories } from '../repositories'

/**
 * Inventory JSON (schemaVersion 3): clients → environments → groups → connections, accesses,
 * workflows and group variables, plus the FortiGate SSL-VPN / IPsec VPNs and which one each
 * level uses. Never a secret, never a VPN user, never an OpenVPN profile (personal .ovpn).
 * Ids don't survive another North, so every reference travels by name.
 */

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'erro')
const lower = (s: string) => s.toLowerCase()

/** VPNs that travel in the file (OpenVPN is each person's own .ovpn). */
const exportable = (p: VpnProfile) => p.kind !== 'openvpn'

export function buildInventoryExport(repositories: Repositories): InventoryExport {
  const tags = repositories.tags.list().map((t) => ({ name: t.name, color: t.color }))

  const clientsById = new Map(repositories.clients.list().map((c) => [c.id, c]))
  const vpnProfiles = repositories.vpnProfiles.list().filter(exportable)
  const vpnName = new Map(vpnProfiles.map((p) => [p.id, p.name]))
  const nameOf = (id: string | null | undefined) => (id ? (vpnName.get(id) ?? null) : null)

  const vpns: ExportVpn[] = vpnProfiles.map((p) => ({
    name: p.name,
    clientName: p.clientId ? (clientsById.get(p.clientId)?.name ?? null) : null,
    // the user is personal: whoever imports fills in their own
    config: { ...p.config, username: '' } as ExportVpn['config'],
    autoDisconnect: p.autoDisconnect,
    idleTimeoutSec: p.idleTimeoutSec,
    notes: p.notes
  }))

  /** A link to a VPN that isn't in the file (OpenVPN) falls back to inheriting. */
  const vpnRef = (mode: VpnMode, profileId: string | null) => {
    if (mode !== 'profile') return { vpnMode: mode }
    const name = nameOf(profileId)
    return name ? { vpnMode: mode, vpnName: name } : { vpnMode: 'inherit' as const }
  }

  const clients = [...clientsById.values()].map((client) => {
    const environments = repositories.environments.list(client.id).map((environment) => {
      const groups = repositories.groups.list(environment.id).map((group) => {
        const groupConnections = repositories.connections.list({ groupId: group.id })
        const connectionName = new Map(groupConnections.map((c) => [c.id, c.name]))

        const connections = groupConnections.map((connection) => {
          const tagNames = repositories.tags.listForConnection(connection.id).map((t) => t.name)
          return {
            name: connection.name,
            description: connection.description,
            protocol: connection.protocol,
            host: connection.host,
            port: connection.port,
            username: connection.username,
            authMethod: connection.authMethod,
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
            checklist: connection.checklist,
            relatedFiles: connection.relatedFiles,
            isFavorite: connection.isFavorite,
            tagNames,
            ...vpnRef(connection.vpnMode, connection.vpnProfileId)
          }
        })

        const accesses = repositories.accesses.list({ groupId: group.id }).map((access) => {
          const tagNames = repositories.tags.listForAccess(access.id).map((t) => t.name)
          return {
            type: access.type,
            name: access.name,
            description: access.description,
            notes: access.notes,
            username: access.username,
            url: access.url,
            links: access.links,
            icon: access.icon,
            color: access.color,
            isFavorite: access.isFavorite,
            engine: access.engine,
            host: access.host,
            port: access.port,
            database: access.database,
            ssl: access.ssl,
            tagNames,
            ...vpnRef(access.vpnMode, access.vpnProfileId)
          }
        })

        const workflows = repositories.workflows.listByGroup(group.id).map((w) => ({
          name: w.name,
          description: w.description,
          icon: w.icon,
          preferredConnectionName: w.preferredConnectionId
            ? (connectionName.get(w.preferredConnectionId) ?? null)
            : null,
          sortOrder: w.sortOrder,
          definition: w.definition
        }))

        const variables = repositories.groupVariables.listByGroup(group.id).map((v) => ({
          key: v.key,
          value: v.value,
          description: v.description
        }))

        return {
          name: group.name,
          notes: group.notes,
          sortOrder: group.sortOrder,
          connections,
          accesses,
          workflows,
          variables
        }
      })
      return {
        name: environment.name,
        notes: environment.notes,
        color: environment.color,
        sortOrder: environment.sortOrder,
        vpnName: nameOf(repositories.vpnProfiles.linkForEnvironment(environment.id).environment),
        groups
      }
    })

    return {
      name: client.name,
      notes: client.notes,
      color: client.color,
      vpnName: nameOf(repositories.vpnProfiles.linkForClient(client.id)),
      environments
    }
  })

  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    includeSecrets: false,
    clients,
    tags,
    vpns
  }
}

/**
 * Merges a file into this North. Anything already here (same name, case-insensitive) is
 * kept as is and counted as skipped; links (VPN of a client/environment) are only filled in
 * where there is none yet.
 */
export function importInventory(repositories: Repositories, data: InventoryExport): ImportReport {
  const report = emptyImportReport()
  const tagIdByName = new Map<string, string>()

  for (const tag of repositories.tags.list()) {
    tagIdByName.set(lower(tag.name), tag.id)
  }

  for (const tagInput of data.tags) {
    const key = lower(tagInput.name)
    if (tagIdByName.has(key)) {
      report.skipped.tags += 1
      continue
    }
    try {
      const created = repositories.tags.create(tagInput)
      tagIdByName.set(key, created.id)
      report.created.tags += 1
    } catch (error) {
      report.errors.push(`Tag “${tagInput.name}”: ${errorText(error)}`)
    }
  }

  const tagIds = (names: string[] | undefined) =>
    (names ?? []).map((n) => tagIdByName.get(lower(n))).filter((id): id is string => Boolean(id))

  // VPNs first: connections and accesses below point at them by name
  const vpnIdByName = new Map<string, string>()
  for (const p of repositories.vpnProfiles.list()) vpnIdByName.set(lower(p.name), p.id)
  /** created here, still waiting for their client (it may be created further down) */
  const vpnOwner = new Map<string, string>()
  for (const vpn of data.vpns) {
    const key = lower(vpn.name)
    if (vpnIdByName.has(key)) {
      report.skipped.vpns += 1
      continue
    }
    try {
      const created = repositories.vpnProfiles.create({
        name: vpn.name,
        config: vpn.config,
        autoDisconnect: vpn.autoDisconnect,
        idleTimeoutSec: vpn.idleTimeoutSec,
        notes: vpn.notes
      })
      vpnIdByName.set(key, created.id)
      if (vpn.clientName) vpnOwner.set(created.id, lower(vpn.clientName))
      report.created.vpns += 1
    } catch (error) {
      report.errors.push(`VPN “${vpn.name}”: ${errorText(error)}`)
    }
  }
  const vpnId = (name: string | null | undefined) =>
    name ? (vpnIdByName.get(lower(name)) ?? null) : null
  /** A VPN missing from this North (not in the file, failed to import) → inherit. */
  const vpnLink = (mode: VpnMode | undefined, name: string | null | undefined) => {
    if (mode !== 'profile') return { vpnMode: mode ?? 'inherit', vpnProfileId: null }
    const id = vpnId(name)
    return id
      ? { vpnMode: mode, vpnProfileId: id }
      : { vpnMode: 'inherit' as const, vpnProfileId: null }
  }

  const clientIdByName = new Map<string, string>()
  const existingClients = repositories.clients.list()

  for (const clientInput of data.clients) {
    let client = existingClients.find((c) => lower(c.name) === lower(clientInput.name))
    if (client) {
      report.skipped.clients += 1
    } else {
      try {
        client = repositories.clients.create({
          name: clientInput.name,
          notes: clientInput.notes,
          color: clientInput.color
        })
        report.created.clients += 1
      } catch (error) {
        report.errors.push(`Cliente “${clientInput.name}”: ${errorText(error)}`)
        continue
      }
    }
    clientIdByName.set(lower(client.name), client.id)
    const clientVpn = vpnId(clientInput.vpnName)
    if (clientVpn && !repositories.vpnProfiles.linkForClient(client.id)) {
      repositories.vpnProfiles.setClientLink(client.id, clientVpn)
    }

    const existingEnvs = repositories.environments.list(client.id)
    for (const envInput of clientInput.environments) {
      let environment = existingEnvs.find((e) => lower(e.name) === lower(envInput.name))
      if (environment) {
        report.skipped.environments += 1
      } else {
        try {
          environment = repositories.environments.create({
            clientId: client.id,
            name: envInput.name,
            notes: envInput.notes,
            color: envInput.color,
            sortOrder: envInput.sortOrder
          })
          report.created.environments += 1
        } catch (error) {
          report.errors.push(`Ambiente “${envInput.name}”: ${errorText(error)}`)
          continue
        }
      }
      const envVpn = vpnId(envInput.vpnName)
      if (envVpn && !repositories.vpnProfiles.linkForEnvironment(environment.id).environment) {
        repositories.vpnProfiles.setEnvironmentLink(environment.id, envVpn)
      }

      const existingGroups = repositories.groups.list(environment.id)
      for (const groupInput of envInput.groups) {
        let group = existingGroups.find((g) => lower(g.name) === lower(groupInput.name))
        if (group) {
          report.skipped.groups += 1
        } else {
          try {
            group = repositories.groups.create({
              environmentId: environment.id,
              name: groupInput.name,
              notes: groupInput.notes,
              sortOrder: groupInput.sortOrder
            })
            report.created.groups += 1
          } catch (error) {
            report.errors.push(`Grupo “${groupInput.name}”: ${errorText(error)}`)
            continue
          }
        }
        const groupId = group.id

        const existingConnections = repositories.connections.list({ groupId })
        for (const connInput of groupInput.connections) {
          if (existingConnections.some((c) => lower(c.name) === lower(connInput.name))) {
            report.skipped.connections += 1
            continue
          }
          try {
            const { tagNames, vpnMode, vpnName, ...rest } = connInput
            const created = repositories.connections.create({
              ...rest,
              ...vpnLink(vpnMode, vpnName),
              groupId,
              credentialRef: null
            })
            const ids = tagIds(tagNames)
            if (ids.length > 0) {
              repositories.tags.setForConnection({ connectionId: created.id, tagIds: ids })
            }
            report.created.connections += 1
          } catch (error) {
            report.errors.push(`Conexão “${connInput.name}”: ${errorText(error)}`)
          }
        }

        const existingAccesses = repositories.accesses.list({ groupId })
        for (const accessInput of groupInput.accesses ?? []) {
          if (existingAccesses.some((a) => lower(a.name) === lower(accessInput.name))) {
            report.skipped.accesses += 1
            continue
          }
          try {
            const { tagNames, vpnMode, vpnName, ...rest } = accessInput
            const created = repositories.accesses.create({
              ...rest,
              ...vpnLink(vpnMode, vpnName),
              groupId,
              credentialRef: null
            })
            const ids = tagIds(tagNames)
            if (ids.length > 0) {
              repositories.tags.setForAccess({ accessId: created.id, tagIds: ids })
            }
            report.created.accesses += 1
          } catch (error) {
            report.errors.push(`Access “${accessInput.name}”: ${errorText(error)}`)
          }
        }

        // after the connections, so a workflow finds its preferred server among them
        const connectionIdByName = new Map(
          repositories.connections.list({ groupId }).map((c) => [lower(c.name), c.id])
        )
        const existingWorkflows = repositories.workflows.listByGroup(groupId)
        for (const wf of groupInput.workflows ?? []) {
          if (existingWorkflows.some((w) => lower(w.name) === lower(wf.name))) {
            report.skipped.workflows += 1
            continue
          }
          try {
            repositories.workflows.create({
              groupId,
              name: wf.name,
              description: wf.description,
              icon: wf.icon,
              preferredConnectionId: wf.preferredConnectionName
                ? (connectionIdByName.get(lower(wf.preferredConnectionName)) ?? null)
                : null,
              sortOrder: wf.sortOrder,
              definition: wf.definition
            })
            report.created.workflows += 1
          } catch (error) {
            report.errors.push(`Workflow “${wf.name}”: ${errorText(error)}`)
          }
        }

        const existingVariables = repositories.groupVariables.listByGroup(groupId)
        for (const variable of groupInput.variables ?? []) {
          if (existingVariables.some((v) => v.key === variable.key)) {
            report.skipped.variables += 1
            continue
          }
          try {
            repositories.groupVariables.create({ groupId, ...variable })
            report.created.variables += 1
          } catch (error) {
            report.errors.push(`Variável “${variable.key}”: ${errorText(error)}`)
          }
        }
      }
    }
  }

  // a VPN's client may only exist now (created by this same import)
  for (const [profileId, clientName] of vpnOwner) {
    const clientId = clientIdByName.get(clientName)
    if (clientId) repositories.vpnProfiles.update(profileId, { clientId })
  }

  return report
}
