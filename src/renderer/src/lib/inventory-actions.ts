import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { ImportReport } from '@shared/types'
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export function formatImportReport(report: ImportReport): string {
  const { created, skipped, errors } = report
  const parts = [
    `Criados ${created.connections} conexões`,
    `${created.accesses} accesses`,
    `ignorados ${skipped.connections + skipped.accesses}`,
    errors.length ? `${errors.length} erros` : null
  ].filter(Boolean)
  return parts.join(' · ')
}

export async function invalidateAfterInventoryImport(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.environments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.connections.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accesses.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.index }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stats.overview })
  ])
}

/** Abre o diálogo nativo e exporta o inventário (sem segredos). */
export async function exportInventory(): Promise<{ canceled: boolean; filePath: string | null }> {
  try {
    const result = await window.north.inventory.export()
    if (!result.canceled && result.filePath) {
      toastSuccess('Inventário exportado')
    }
    return result
  } catch (error: unknown) {
    toastError(error)
    throw error
  }
}

/**
 * Abre o diálogo nativo, importa o inventário e invalida caches.
 * Retorna o relatório quando a importação não foi cancelada.
 */
export async function importInventory(
  queryClient?: QueryClient
): Promise<{ canceled: boolean; report: ImportReport | null }> {
  try {
    const result = await window.north.inventory.import()
    if (result.canceled || !result.report) return result

    const summary = formatImportReport(result.report)
    if (result.report.errors.length) toastError(summary)
    else toastSuccess(summary)

    if (queryClient) {
      await invalidateAfterInventoryImport(queryClient)
    } else {
      await window.north.search.index()
    }

    return result
  } catch (error: unknown) {
    toastError(error)
    throw error
  }
}

/**
 * Importa planilha CSV. `allowSecrets` deve ser true só após confirmação explícita na UI.
 */
export async function importInventoryCsv(
  allowSecrets: boolean,
  queryClient?: QueryClient
): Promise<{ canceled: boolean; report: ImportReport | null }> {
  try {
    const result = await window.north.inventory.importCsv({ allowSecrets })
    if (result.canceled || !result.report) return result

    const summary = formatImportReport(result.report)
    if (result.report.errors.length) toastError(summary)
    else toastSuccess(summary)

    if (queryClient) {
      await invalidateAfterInventoryImport(queryClient)
    } else {
      await window.north.search.index()
    }

    return result
  } catch (error: unknown) {
    toastError(error)
    throw error
  }
}

/** Salva o CSV modelo via diálogo nativo. */
export async function downloadCsvTemplate(): Promise<{
  canceled: boolean
  filePath: string | null
}> {
  try {
    const result = await window.north.inventory.downloadCsvTemplate()
    if (!result.canceled && result.filePath) {
      toastSuccess('Modelo CSV salvo')
    }
    return result
  } catch (error: unknown) {
    toastError(error)
    throw error
  }
}
