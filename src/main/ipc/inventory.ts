import { readFile, writeFile } from 'node:fs/promises'
import { IpcChannels } from '@shared/ipc'
import {
  CSV_TEMPLATE_CONTENT,
  CSV_TEMPLATE_FILENAME,
  emptyImportReport,
  InventoryExportSchema
} from '@shared/types'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import { importInventoryCsv } from '../services/inventory-csv-import'
import { buildInventoryExport, importInventory } from '../services/inventory-json'
import type { CredentialVault } from '../vault'

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

    const payload = buildInventoryExport(repositories)
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
        report: { ...emptyImportReport(), errors: ['Arquivo JSON inválido'] }
      }
    }

    const validated = InventoryExportSchema.safeParse(parsed)
    if (!validated.success) {
      return {
        canceled: false,
        report: {
          ...emptyImportReport(),
          errors: ['Arquivo de inventário inválido ou de uma versão mais nova do North']
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
