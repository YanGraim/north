import { IpcChannels } from '@shared/ipc'
import {
  DatabaseTestInputSchema,
  DbCancelInputSchema,
  DbCommitInputSchema,
  DbExportInputSchema,
  DbIntrospectInputSchema,
  DbQueryInputSchema,
  DbRollbackInputSchema,
  DbSetAutoCommitInputSchema,
  DbTxStateInputSchema,
  isSqlStudioEngine
} from '@shared/protocols'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { configFromTestInput, exportLimitsForFormat } from '../protocols/database/config'
import { EXPORT_EXTENSIONS, EXPORT_FILTER_NAMES, writeExport } from '../protocols/database/export'
import { testConnection } from '../protocols/database/registry'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import { getProtocolManager } from './sessions'

function requireDatabase(sessionId: string) {
  const session = getProtocolManager().getActiveSession(sessionId)
  if (!session) {
    throw new Error('Sessão não encontrada')
  }
  if (!session.database) {
    throw new Error('Esta sessão não é um estúdio SQL')
  }
  if (session.state !== 'connected') {
    throw new Error('Sessão não está conectada')
  }
  return session.database
}

export function registerDatabaseHandlers(repositories: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.DB_TEST, async (_event, raw: unknown) => {
    const input = DatabaseTestInputSchema.parse(raw)
    if (!isSqlStudioEngine(input.engine)) {
      return { ok: false, message: 'Engine não suportado no estúdio SQL' }
    }

    let password = input.password ?? ''
    if (!input.password) {
      const credentialRef =
        input.credentialRef ??
        (input.accessId ? (repositories.accesses.get(input.accessId)?.credentialRef ?? null) : null)
      if (credentialRef) {
        try {
          password = await vault.resolveSecret(credentialRef)
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : 'Não foi possível ler a senha'
          }
        }
      }
    }

    const config = configFromTestInput({ ...input, password })
    return testConnection(config)
  })

  ipcMain.handle(IpcChannels.DB_INTROSPECT, async (_event, raw: unknown) => {
    const input = DbIntrospectInputSchema.parse(raw)
    return requireDatabase(input.sessionId).introspect()
  })

  ipcMain.handle(IpcChannels.DB_QUERY, async (_event, raw: unknown) => {
    const input = DbQueryInputSchema.parse(raw)
    return requireDatabase(input.sessionId).query(input.sql)
  })

  ipcMain.handle(IpcChannels.DB_CANCEL, async (_event, raw: unknown) => {
    const input = DbCancelInputSchema.parse(raw)
    await requireDatabase(input.sessionId).cancel()
  })

  ipcMain.handle(IpcChannels.DB_TX_STATE, async (_event, raw: unknown) => {
    const input = DbTxStateInputSchema.parse(raw)
    return requireDatabase(input.sessionId).getTxState()
  })

  ipcMain.handle(IpcChannels.DB_SET_AUTO_COMMIT, async (_event, raw: unknown) => {
    const input = DbSetAutoCommitInputSchema.parse(raw)
    const database = requireDatabase(input.sessionId)
    await database.setAutoCommit(input.autoCommit)
    return database.getTxState()
  })

  ipcMain.handle(IpcChannels.DB_COMMIT, async (_event, raw: unknown) => {
    const input = DbCommitInputSchema.parse(raw)
    const database = requireDatabase(input.sessionId)
    await database.commit()
    return database.getTxState()
  })

  ipcMain.handle(IpcChannels.DB_ROLLBACK, async (_event, raw: unknown) => {
    const input = DbRollbackInputSchema.parse(raw)
    const database = requireDatabase(input.sessionId)
    await database.rollback()
    return database.getTxState()
  })

  ipcMain.handle(IpcChannels.DB_PICK_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Arquivo SQLite',
          properties: ['openFile', 'showHiddenFiles'],
          filters: [
            { name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] },
            { name: 'Todos os arquivos', extensions: ['*'] }
          ]
        })
      : await dialog.showOpenDialog({
          title: 'Arquivo SQLite',
          properties: ['openFile', 'showHiddenFiles'],
          filters: [
            { name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] },
            { name: 'Todos os arquivos', extensions: ['*'] }
          ]
        })

    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannels.DB_EXPORT, async (event, raw: unknown) => {
    const input = DbExportInputSchema.parse(raw)
    const extension = EXPORT_EXTENSIONS[input.format]
    const filterName = EXPORT_FILTER_NAMES[input.format]
    const defaultPath = `${input.suggestedName}-${new Date().toISOString().slice(0, 10)}.${extension}`

    const win = BrowserWindow.fromWebContents(event.sender)
    const saveResult = win
      ? await dialog.showSaveDialog(win, {
          title: 'Exportar resultados',
          defaultPath,
          filters: [{ name: filterName, extensions: [extension] }]
        })
      : await dialog.showSaveDialog({
          title: 'Exportar resultados',
          defaultPath,
          filters: [{ name: filterName, extensions: [extension] }]
        })

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true, filePath: null, rowCount: 0, truncated: false }
    }

    const filePath = saveResult.filePath
    const engine =
      input.source === 'rows'
        ? input.engine
        : (() => {
            const active = getProtocolManager().getActiveSession(input.sessionId)
            return active && isSqlStudioEngine(active.protocol) ? active.protocol : undefined
          })()

    if (input.source === 'rows') {
      await writeExport(
        filePath,
        input.format,
        { columns: input.columns, rows: input.rows },
        input.options,
        { engine }
      )
      return {
        canceled: false,
        filePath,
        rowCount: input.rows.length,
        truncated: false
      }
    }

    const database = requireDatabase(input.sessionId)
    const limits = exportLimitsForFormat(input.format)
    const queryResult = await database.query(input.sql, limits)
    await writeExport(
      filePath,
      input.format,
      { columns: queryResult.columns, rows: queryResult.rows },
      input.options,
      { engine }
    )

    return {
      canceled: false,
      filePath,
      rowCount: queryResult.rowCount,
      truncated: queryResult.truncated
    }
  })
}
