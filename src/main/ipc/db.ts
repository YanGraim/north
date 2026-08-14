import { IpcChannels } from '@shared/ipc'
import {
  DatabaseTestInputSchema,
  DbCancelInputSchema,
  DbCommitInputSchema,
  DbIntrospectInputSchema,
  DbQueryInputSchema,
  DbRollbackInputSchema,
  DbSetAutoCommitInputSchema,
  DbTxStateInputSchema,
  isSqlStudioEngine
} from '@shared/protocols'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { configFromTestInput } from '../protocols/database/config'
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
}
