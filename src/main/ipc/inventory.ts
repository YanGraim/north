import { readFile, writeFile } from 'node:fs/promises'
import { IpcChannels } from '@shared/ipc'
import type { ImportReport, InventoryExport } from '@shared/types'
import { CSV_TEMPLATE_CONTENT, CSV_TEMPLATE_FILENAME, InventoryExportSchema } from '@shared/types'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import { importInventoryCsv } from '../services/inventory-csv-import'
import type { CredentialVault } from '../vault'

function emptyReport(): ImportReport {
  return {
    created: {
      clients: 0,
      environments: 0,
      groups: 0,
      connections: 0,
      accesses: 0,
      tags: 0
    },
    skipped: {
      clients: 0,
      environments: 0,
      groups: 0,
      connections: 0,
      accesses: 0,
      tags: 0
    },
    errors: []
  }
}

function buildExport(repositories: Repositories): InventoryExport {
  const tags = repositories.tags.list().map((t) => ({
    name: t.name,
    color: t.color
  }))

  const clients = repositories.clients.list().map((client) => {
    const environments = repositories.environments.list(client.id).map((environment) => {
      const groups = repositories.groups.list(environment.id).map((group) => {
        const connections = repositories.connections
          .list({ groupId: group.id })
          .map((connection) => {
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
              tagNames
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
            tagNames
          }
        })

        return {
          name: group.name,
          notes: group.notes,
          sortOrder: group.sortOrder,
          connections,
          accesses
        }
      })
      return {
        name: environment.name,
        notes: environment.notes,
        color: environment.color,
        sortOrder: environment.sortOrder,
        groups
      }
    })

    return {
      name: client.name,
      notes: client.notes,
      color: client.color,
      environments
    }
  })

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    includeSecrets: false,
    clients,
    tags
  }
}

function importInventory(repositories: Repositories, data: InventoryExport): ImportReport {
  const report = emptyReport()
  const tagIdByName = new Map<string, string>()

  for (const tag of repositories.tags.list()) {
    tagIdByName.set(tag.name.toLowerCase(), tag.id)
  }

  for (const tagInput of data.tags) {
    const key = tagInput.name.toLowerCase()
    if (tagIdByName.has(key)) {
      report.skipped.tags += 1
      continue
    }
    try {
      const created = repositories.tags.create(tagInput)
      tagIdByName.set(key, created.id)
      report.created.tags += 1
    } catch (error) {
      report.errors.push(
        `Tag “${tagInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
      )
    }
  }

  const existingClients = repositories.clients.list()

  for (const clientInput of data.clients) {
    let client = existingClients.find(
      (c) => c.name.toLowerCase() === clientInput.name.toLowerCase()
    )
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
        report.errors.push(
          `Cliente “${clientInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
        )
        continue
      }
    }

    const existingEnvs = repositories.environments.list(client.id)
    for (const envInput of clientInput.environments) {
      let environment = existingEnvs.find(
        (e) => e.name.toLowerCase() === envInput.name.toLowerCase()
      )
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
          report.errors.push(
            `Ambiente “${envInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
          )
          continue
        }
      }

      const existingGroups = repositories.groups.list(environment.id)
      for (const groupInput of envInput.groups) {
        let group = existingGroups.find(
          (g) => g.name.toLowerCase() === groupInput.name.toLowerCase()
        )
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
            report.errors.push(
              `Grupo “${groupInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
            )
            continue
          }
        }

        const existingConnections = repositories.connections.list({ groupId: group.id })
        for (const connInput of groupInput.connections) {
          const exists = existingConnections.some(
            (c) => c.name.toLowerCase() === connInput.name.toLowerCase()
          )
          if (exists) {
            report.skipped.connections += 1
            continue
          }
          try {
            const { tagNames, ...rest } = connInput
            const created = repositories.connections.create({
              ...rest,
              groupId: group.id,
              credentialRef: null
            })
            if (tagNames && tagNames.length > 0) {
              const tagIds = tagNames
                .map((name) => tagIdByName.get(name.toLowerCase()))
                .filter((id): id is string => Boolean(id))
              if (tagIds.length > 0) {
                repositories.tags.setForConnection({ connectionId: created.id, tagIds })
              }
            }
            report.created.connections += 1
          } catch (error) {
            report.errors.push(
              `Conexão “${connInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
            )
          }
        }

        const existingAccesses = repositories.accesses.list({ groupId: group.id })
        for (const accessInput of groupInput.accesses ?? []) {
          const exists = existingAccesses.some(
            (a) => a.name.toLowerCase() === accessInput.name.toLowerCase()
          )
          if (exists) {
            report.skipped.accesses += 1
            continue
          }
          try {
            const { tagNames, ...rest } = accessInput
            const created = repositories.accesses.create({
              ...rest,
              groupId: group.id,
              credentialRef: null
            })
            if (tagNames && tagNames.length > 0) {
              const tagIds = tagNames
                .map((name) => tagIdByName.get(name.toLowerCase()))
                .filter((id): id is string => Boolean(id))
              if (tagIds.length > 0) {
                repositories.tags.setForAccess({ accessId: created.id, tagIds })
              }
            }
            report.created.accesses += 1
          } catch (error) {
            report.errors.push(
              `Access “${accessInput.name}”: ${error instanceof Error ? error.message : 'erro'}`
            )
          }
        }
      }
    }
  }

  return report
}

export function registerInventoryHandlers(
  repositories: Repositories,
  vault: CredentialVault
): void {
  ipcMain.handle(IpcChannels.INVENTORY_EXPORT, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, {
          title: 'Exportar inventário',
          defaultPath: `north-inventory-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
      : await dialog.showSaveDialog({
          title: 'Exportar inventário',
          defaultPath: `north-inventory-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })

    if (result.canceled || !result.filePath) {
      return { canceled: true, filePath: null }
    }

    const payload = buildExport(repositories)
    await writeFile(result.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle(IpcChannels.INVENTORY_IMPORT, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Importar inventário',
          filters: [{ name: 'JSON', extensions: ['json'] }],
          properties: ['openFile']
        })
      : await dialog.showOpenDialog({
          title: 'Importar inventário',
          filters: [{ name: 'JSON', extensions: ['json'] }],
          properties: ['openFile']
        })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, report: null }
    }

    const raw = await readFile(result.filePaths[0], 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return {
        canceled: false,
        report: { ...emptyReport(), errors: ['Arquivo JSON inválido'] }
      }
    }

    const validated = InventoryExportSchema.safeParse(parsed)
    if (!validated.success) {
      return {
        canceled: false,
        report: {
          ...emptyReport(),
          errors: ['Schema de inventário inválido (esperado schemaVersion 1 ou 2)']
        }
      }
    }

    const report = importInventory(repositories, validated.data)
    return { canceled: false, report }
  })

  ipcMain.handle(
    IpcChannels.INVENTORY_IMPORT_CSV,
    async (event, options: { allowSecrets: boolean }) => {
      const allowSecrets = Boolean(options?.allowSecrets)
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: 'Importar planilha (CSV)',
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            properties: ['openFile']
          })
        : await dialog.showOpenDialog({
            title: 'Importar planilha (CSV)',
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            properties: ['openFile']
          })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, report: null }
      }

      const raw = await readFile(result.filePaths[0], 'utf8')
      const report = importInventoryCsv(repositories, raw, { allowSecrets }, vault)
      return { canceled: false, report }
    }
  )

  ipcMain.handle(IpcChannels.INVENTORY_DOWNLOAD_CSV_TEMPLATE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, {
          title: 'Salvar modelo CSV',
          defaultPath: CSV_TEMPLATE_FILENAME,
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        })
      : await dialog.showSaveDialog({
          title: 'Salvar modelo CSV',
          defaultPath: CSV_TEMPLATE_FILENAME,
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        })

    if (result.canceled || !result.filePath) {
      return { canceled: true, filePath: null }
    }

    await writeFile(result.filePath, CSV_TEMPLATE_CONTENT, 'utf8')
    return { canceled: false, filePath: result.filePath }
  })
}
