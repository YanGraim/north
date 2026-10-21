import {
  defaultPortForProtocol,
  emptyImportReport,
  type ImportReport,
  type InventoryCsvRow,
  parseInventoryCsvRow,
  parseTagNames,
  REQUIRED_CSV_HEADERS
} from '@shared/types'
import type { Repositories } from '../repositories'
import type { InventoryStore } from '../workspaces/inventory-store'
import type { SecretStore } from '../workspaces/secret-store'
import { parseCsv } from './csv-parse'

/**
 * Where the rows land: the active workspace's tree and passwords (SQLite +
 * vault, or a North Server). Accesses only exist in the personal workspace
 * for now (ADR 0018), so an organization passes `accesses: null`.
 */
export type CsvImportTarget = {
  inventory: InventoryStore
  secrets: SecretStore | null
  accesses: Repositories['accesses'] | null
}

export const ACCESSES_UNAVAILABLE =
  'acessos (banco/login) ainda não existem numa organização — importe-os no Meu workspace'

export type ImportCsvOptions = {
  /** When true, non-empty `senha` cells are written to the vault. */
  allowSecrets: boolean
}

const emptyReport = emptyImportReport

async function ensureTags(
  inventory: InventoryStore,
  tagIdByName: Map<string, string>,
  names: string[],
  report: ImportReport
): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    let id = tagIdByName.get(key)
    if (!id) {
      try {
        const created = await inventory.tags.create({ name, color: null })
        id = created.id
        tagIdByName.set(key, id)
        report.created.tags += 1
      } catch (error) {
        report.errors.push(`Tag “${name}”: ${error instanceof Error ? error.message : 'erro'}`)
        continue
      }
    }
    ids.push(id)
  }
  return ids
}

async function resolveHierarchy(
  inventory: InventoryStore,
  report: ImportReport,
  row: InventoryCsvRow,
  lineLabel: string
): Promise<{ groupId: string } | null> {
  const existingClients = await inventory.clients.list()
  let client = existingClients.find((c) => c.name.toLowerCase() === row.cliente.toLowerCase())
  if (!client) {
    try {
      client = await inventory.clients.create({
        name: row.cliente,
        notes: null,
        color: null
      })
      report.created.clients += 1
    } catch (error) {
      report.errors.push(
        `${lineLabel}: cliente “${row.cliente}”: ${error instanceof Error ? error.message : 'erro'}`
      )
      return null
    }
  } else {
    // Count skip only once per distinct name is hard in CSV; we don't increment skip for reuse.
  }

  const existingEnvs = await inventory.environments.list(client.id)
  let environment = existingEnvs.find((e) => e.name.toLowerCase() === row.ambiente.toLowerCase())
  if (!environment) {
    try {
      environment = await inventory.environments.create({
        clientId: client.id,
        name: row.ambiente,
        notes: null,
        sortOrder: 0
      })
      report.created.environments += 1
    } catch (error) {
      report.errors.push(
        `${lineLabel}: ambiente “${row.ambiente}”: ${
          error instanceof Error ? error.message : 'erro'
        }`
      )
      return null
    }
  }

  const existingGroups = await inventory.groups.list(environment.id)
  let group = existingGroups.find((g) => g.name.toLowerCase() === row.grupo.toLowerCase())
  if (!group) {
    try {
      group = await inventory.groups.create({
        environmentId: environment.id,
        name: row.grupo,
        notes: null,
        sortOrder: 0
      })
      report.created.groups += 1
    } catch (error) {
      report.errors.push(
        `${lineLabel}: grupo “${row.grupo}”: ${error instanceof Error ? error.message : 'erro'}`
      )
      return null
    }
  }

  return { groupId: group.id }
}

async function storeSecret(
  secrets: SecretStore | null,
  allowSecrets: boolean,
  senha: string | undefined,
  lineLabel: string,
  report: ImportReport
): Promise<string | null> {
  if (!senha) return null
  if (!allowSecrets) {
    report.errors.push(
      `${lineLabel}: senha ignorada (importe novamente confirmando que o CSV contém senhas)`
    )
    return null
  }
  if (!secrets || !(await secrets.isAvailable())) {
    report.errors.push(`${lineLabel}: vault indisponível para gravar senha`)
    return null
  }
  try {
    return await secrets.set(senha)
  } catch (error) {
    report.errors.push(
      `${lineLabel}: falha ao gravar senha: ${error instanceof Error ? error.message : 'erro'}`
    )
    return null
  }
}

/**
 * Import inventory rows from a UTF-8 CSV string.
 * Line numbers in errors are 1-based data rows (header = line 1).
 */
export async function importInventoryCsv(
  target: CsvImportTarget,
  content: string,
  options: ImportCsvOptions
): Promise<ImportReport> {
  const { inventory, secrets, accesses } = target
  const report = emptyReport()

  let parsed: ReturnType<typeof parseCsv>
  try {
    parsed = parseCsv(content)
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : 'Falha ao ler CSV')
    return report
  }

  const headerSet = new Set(parsed.headers)
  const missing = REQUIRED_CSV_HEADERS.filter((h) => !headerSet.has(h))
  if (missing.length > 0) {
    report.errors.push(`Cabeçalhos ausentes: ${missing.join(', ')}`)
    return report
  }

  const tagIdByName = new Map<string, string>()
  for (const tag of await inventory.tags.list()) {
    tagIdByName.set(tag.name.toLowerCase(), tag.id)
  }

  // Rows run in order: a later row may reuse the client/tag an earlier one created.
  for (const [index, record] of parsed.records.entries()) {
    const lineNumber = index + 2 // header is line 1
    const lineLabel = `Linha ${lineNumber}`

    const validated = parseInventoryCsvRow(record)
    if (!validated.success) {
      report.errors.push(`${lineLabel}: ${validated.error}`)
      continue
    }

    const row = validated.data
    if (row.tipo !== 'servidor' && !accesses) {
      report.errors.push(`${lineLabel}: ${ACCESSES_UNAVAILABLE}`)
      continue
    }
    const hierarchy = await resolveHierarchy(inventory, report, row, lineLabel)
    if (!hierarchy) continue

    const tagNames = parseTagNames(row.tags)
    const tagIds = await ensureTags(inventory, tagIdByName, tagNames, report)
    const credentialRef = await storeSecret(
      secrets,
      options.allowSecrets,
      row.senha,
      lineLabel,
      report
    )

    try {
      if (row.tipo === 'servidor') {
        const existing = await inventory.connections.list({ groupId: hierarchy.groupId })
        if (existing.some((c) => c.name.toLowerCase() === row.nome.toLowerCase())) {
          report.skipped.connections += 1
          // The password was stored for nothing; don't leave it behind.
          if (credentialRef) await secrets?.delete(credentialRef)
          continue
        }

        const created = await inventory.connections.create({
          groupId: hierarchy.groupId,
          name: row.nome,
          description: null,
          protocol: row.protocolo,
          host: row.host,
          port: row.porta ?? defaultPortForProtocol(row.protocolo),
          username: row.usuario ?? null,
          authMethod: credentialRef ? 'password' : row.usuario ? 'password' : 'none',
          credentialRef,
          privateKeyPath: null,
          jumpHostId: null,
          defaultCommand: null,
          notes: row.notas ?? null,
          os: null,
          icon: null,
          color: null,
          owner: null,
          links: [],
          vpnRequired: false,
          checklist: [],
          relatedFiles: [],
          isFavorite: false
        })

        if (tagIds.length > 0) {
          await inventory.tags.setForConnection({ connectionId: created.id, tagIds })
        }
        report.created.connections += 1
        continue
      }

      const store = accesses as Repositories['accesses']
      const existingAccesses = store.list({ groupId: hierarchy.groupId })
      if (existingAccesses.some((a) => a.name.toLowerCase() === row.nome.toLowerCase())) {
        report.skipped.accesses += 1
        if (credentialRef) await secrets?.delete(credentialRef)
        continue
      }

      if (row.tipo === 'banco') {
        const created = store.create({
          groupId: hierarchy.groupId,
          type: 'database',
          name: row.nome,
          description: null,
          notes: row.notas ?? null,
          username: row.usuario ?? null,
          credentialRef,
          url: null,
          links: [],
          icon: null,
          color: null,
          isFavorite: false,
          engine: row.engine,
          host: row.host,
          port: row.porta ?? null,
          database: row.database ?? null,
          ssl: null
        })
        if (tagIds.length > 0) {
          await inventory.tags.setForAccess({ accessId: created.id, tagIds })
        }
        report.created.accesses += 1
        continue
      }

      // login
      const created = store.create({
        groupId: hierarchy.groupId,
        type: 'login',
        name: row.nome,
        description: null,
        notes: row.notas ?? null,
        username: row.usuario,
        credentialRef,
        url: row.url,
        links: [],
        icon: null,
        color: null,
        isFavorite: false,
        engine: null,
        host: null,
        port: null,
        database: null,
        ssl: null
      })
      if (tagIds.length > 0) {
        await inventory.tags.setForAccess({ accessId: created.id, tagIds })
      }
      report.created.accesses += 1
    } catch (error) {
      report.errors.push(
        `${lineLabel}: ${error instanceof Error ? error.message : 'erro ao criar registro'}`
      )
    }
  }

  return report
}

export { emptyReport as emptyCsvImportReport }
