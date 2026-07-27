import {
  defaultPortForProtocol,
  type ImportReport,
  type InventoryCsvRow,
  parseInventoryCsvRow,
  parseTagNames,
  REQUIRED_CSV_HEADERS
} from '@shared/types'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import { parseCsv } from './csv-parse'

export type ImportCsvOptions = {
  /** When true, non-empty `senha` cells are written to the vault. */
  allowSecrets: boolean
}

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

function ensureTags(
  repositories: Repositories,
  tagIdByName: Map<string, string>,
  names: string[],
  report: ImportReport
): string[] {
  const ids: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    let id = tagIdByName.get(key)
    if (!id) {
      try {
        const created = repositories.tags.create({ name, color: null })
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

function resolveHierarchy(
  repositories: Repositories,
  report: ImportReport,
  row: InventoryCsvRow,
  lineLabel: string
): { groupId: string } | null {
  const existingClients = repositories.clients.list()
  let client = existingClients.find((c) => c.name.toLowerCase() === row.cliente.toLowerCase())
  if (!client) {
    try {
      client = repositories.clients.create({
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

  const existingEnvs = repositories.environments.list(client.id)
  let environment = existingEnvs.find((e) => e.name.toLowerCase() === row.ambiente.toLowerCase())
  if (!environment) {
    try {
      environment = repositories.environments.create({
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

  const existingGroups = repositories.groups.list(environment.id)
  let group = existingGroups.find((g) => g.name.toLowerCase() === row.grupo.toLowerCase())
  if (!group) {
    try {
      group = repositories.groups.create({
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

function storeSecret(
  vault: CredentialVault | null,
  allowSecrets: boolean,
  senha: string | undefined,
  lineLabel: string,
  report: ImportReport
): string | null {
  if (!senha) return null
  if (!allowSecrets) {
    report.errors.push(
      `${lineLabel}: senha ignorada (importe novamente confirmando que o CSV contém senhas)`
    )
    return null
  }
  if (!vault) {
    report.errors.push(`${lineLabel}: vault indisponível para gravar senha`)
    return null
  }
  try {
    return vault.setSecret(senha)
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
export function importInventoryCsv(
  repositories: Repositories,
  content: string,
  options: ImportCsvOptions,
  vault: CredentialVault | null = null
): ImportReport {
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
  for (const tag of repositories.tags.list()) {
    tagIdByName.set(tag.name.toLowerCase(), tag.id)
  }

  parsed.records.forEach((record, index) => {
    const lineNumber = index + 2 // header is line 1
    const lineLabel = `Linha ${lineNumber}`

    const validated = parseInventoryCsvRow(record)
    if (!validated.success) {
      report.errors.push(`${lineLabel}: ${validated.error}`)
      return
    }

    const row = validated.data
    const hierarchy = resolveHierarchy(repositories, report, row, lineLabel)
    if (!hierarchy) return

    const tagNames = parseTagNames(row.tags)
    const tagIds = ensureTags(repositories, tagIdByName, tagNames, report)
    const credentialRef = storeSecret(vault, options.allowSecrets, row.senha, lineLabel, report)

    try {
      if (row.tipo === 'servidor') {
        const existing = repositories.connections.list({ groupId: hierarchy.groupId })
        if (existing.some((c) => c.name.toLowerCase() === row.nome.toLowerCase())) {
          report.skipped.connections += 1
          return
        }

        const created = repositories.connections.create({
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
          repositories.tags.setForConnection({ connectionId: created.id, tagIds })
        }
        report.created.connections += 1
        return
      }

      const existingAccesses = repositories.accesses.list({ groupId: hierarchy.groupId })
      if (existingAccesses.some((a) => a.name.toLowerCase() === row.nome.toLowerCase())) {
        report.skipped.accesses += 1
        return
      }

      if (row.tipo === 'banco') {
        const created = repositories.accesses.create({
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
          repositories.tags.setForAccess({ accessId: created.id, tagIds })
        }
        report.created.accesses += 1
        return
      }

      // login
      const created = repositories.accesses.create({
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
        repositories.tags.setForAccess({ accessId: created.id, tagIds })
      }
      report.created.accesses += 1
    } catch (error) {
      report.errors.push(
        `${lineLabel}: ${error instanceof Error ? error.message : 'erro ao criar registro'}`
      )
    }
  })

  return report
}

export { emptyReport as emptyCsvImportReport }
