import { readFile, writeFile } from 'node:fs/promises'
import { IpcChannels } from '@shared/ipc'
import { parsePostmanCollection } from '@shared/lib/postman-collection'
import {
  ApiCancelInputSchema,
  ApiHistoryListInputSchema,
  ApiSendInputSchema
} from '@shared/protocols'
import {
  ApiCollectionImportInputSchema,
  ApiCollectionListFilterSchema,
  type ApiVariable,
  type ApiVariablePublic,
  CreateApiCollectionInputSchema,
  CreateApiFolderInputSchema,
  CreateApiRequestInputSchema,
  IdSchema,
  MoveApiRequestInputSchema,
  SetApiVariableInputSchema,
  UpdateApiCollectionInputSchema,
  UpdateApiFolderInputSchema,
  UpdateApiRequestInputSchema
} from '@shared/types'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  duplicateCollection,
  exportCollectionJson,
  importParsedCollection
} from '../protocols/api/collection-ops'
import { abortApiSend, executeApiSend } from '../protocols/api/execute-send'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

function toPublicVariable(variable: ApiVariable): ApiVariablePublic {
  if (variable.isSecret) {
    return {
      id: variable.id,
      accessId: variable.accessId,
      key: variable.key,
      value: null,
      isSecret: true,
      hasSecret: Boolean(variable.credentialRef),
      description: variable.description,
      createdAt: variable.createdAt,
      updatedAt: variable.updatedAt
    }
  }
  return {
    id: variable.id,
    accessId: variable.accessId,
    key: variable.key,
    value: variable.value,
    isSecret: false,
    hasSecret: false,
    description: variable.description,
    createdAt: variable.createdAt,
    updatedAt: variable.updatedAt
  }
}

export function registerApiHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.API_SEND, async (_event, raw: unknown) => {
    const input = ApiSendInputSchema.parse(raw)
    return executeApiSend(repos, vault, input)
  })

  ipcMain.handle(IpcChannels.API_CANCEL, (_event, raw: unknown) => {
    const input = ApiCancelInputSchema.parse(raw)
    abortApiSend(input.requestId)
  })

  ipcMain.handle(IpcChannels.API_HISTORY_LIST, (_event, raw: unknown) => {
    const input = ApiHistoryListInputSchema.parse(raw)
    return repos.apiRequestHistory.listByAccess(input.accessId, input.limit ?? 50)
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_LIST, (_event, raw: unknown) => {
    const filter = ApiCollectionListFilterSchema.parse(raw)
    if (!filter || filter.clientId === undefined) {
      return repos.apiCollections.listAll()
    }
    return repos.apiCollections.listByClient(filter.clientId)
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_CREATE, (_event, input: unknown) => {
    return repos.apiCollections.createCollection(CreateApiCollectionInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.apiCollections.updateCollection(
        IdSchema.parse(id),
        UpdateApiCollectionInputSchema.parse(input)
      ),
      'ApiCollection'
    )
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_DELETE, (_event, id: unknown) => {
    const collectionId = IdSchema.parse(id)
    if (!repos.apiCollections.getCollection(collectionId)) {
      throw new Error('ApiCollection not found')
    }
    repos.apiCollections.deleteCollection(collectionId)
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_DUPLICATE, (_event, id: unknown) => {
    return duplicateCollection(repos, IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_IMPORT, async (event, raw: unknown) => {
    const input = ApiCollectionImportInputSchema.parse(raw)
    if (input.document !== undefined) {
      const parsed = parsePostmanCollection(input.document)
      return { canceled: false, collection: importParsedCollection(repos, parsed, input.clientId) }
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Import Postman Collection',
          filters: [{ name: 'Postman Collection', extensions: ['json'] }],
          properties: ['openFile']
        })
      : await dialog.showOpenDialog({
          title: 'Import Postman Collection',
          filters: [{ name: 'Postman Collection', extensions: ['json'] }],
          properties: ['openFile']
        })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, collection: null }
    }
    const text = await readFile(result.filePaths[0], 'utf8')
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(text)
    } catch {
      throw new Error('Arquivo JSON inválido')
    }
    const parsed = parsePostmanCollection(parsedJson)
    return { canceled: false, collection: importParsedCollection(repos, parsed, input.clientId) }
  })

  ipcMain.handle(IpcChannels.API_COLLECTION_EXPORT, async (event, id: unknown) => {
    const collectionId = IdSchema.parse(id)
    const collection = repos.apiCollections.getCollection(collectionId)
    if (!collection) {
      throw new Error('ApiCollection not found')
    }
    const payload = exportCollectionJson(repos, collectionId)
    const safeName = collection.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'collection'
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, {
          title: 'Export Postman Collection',
          defaultPath: `${safeName}.postman_collection.json`,
          filters: [{ name: 'Postman Collection', extensions: ['json'] }]
        })
      : await dialog.showSaveDialog({
          title: 'Export Postman Collection',
          defaultPath: `${safeName}.postman_collection.json`,
          filters: [{ name: 'Postman Collection', extensions: ['json'] }]
        })
    if (result.canceled || !result.filePath) {
      return { canceled: true, filePath: null }
    }
    await writeFile(result.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle(IpcChannels.API_FOLDER_LIST, (_event, collectionId: unknown) => {
    return repos.apiCollections.listFolders(IdSchema.parse(collectionId))
  })

  ipcMain.handle(IpcChannels.API_FOLDER_CREATE, (_event, input: unknown) => {
    return repos.apiCollections.createFolder(CreateApiFolderInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.API_FOLDER_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.apiCollections.updateFolder(
        IdSchema.parse(id),
        UpdateApiFolderInputSchema.parse(input)
      ),
      'ApiFolder'
    )
  })

  ipcMain.handle(IpcChannels.API_FOLDER_DELETE, (_event, id: unknown) => {
    const folderId = IdSchema.parse(id)
    if (!repos.apiCollections.getFolder(folderId)) {
      throw new Error('ApiFolder not found')
    }
    repos.apiCollections.deleteFolder(folderId)
  })

  ipcMain.handle(IpcChannels.API_REQUEST_LIST, (_event, collectionId: unknown) => {
    return repos.apiRequests.listByCollection(IdSchema.parse(collectionId))
  })

  ipcMain.handle(IpcChannels.API_REQUEST_CREATE, (_event, input: unknown) => {
    return repos.apiRequests.create(CreateApiRequestInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.API_REQUEST_UPDATE, (_event, id: unknown, input: unknown) => {
    return requireEntity(
      repos.apiRequests.update(IdSchema.parse(id), UpdateApiRequestInputSchema.parse(input)),
      'ApiRequest'
    )
  })

  ipcMain.handle(IpcChannels.API_REQUEST_DELETE, (_event, id: unknown) => {
    const requestId = IdSchema.parse(id)
    if (!repos.apiRequests.get(requestId)) {
      throw new Error('ApiRequest not found')
    }
    repos.apiRequests.delete(requestId)
  })

  ipcMain.handle(IpcChannels.API_REQUEST_DUPLICATE, (_event, id: unknown) => {
    return requireEntity(repos.apiRequests.duplicate(IdSchema.parse(id)), 'ApiRequest')
  })

  ipcMain.handle(IpcChannels.API_REQUEST_MOVE, (_event, input: unknown) => {
    return requireEntity(
      repos.apiRequests.move(MoveApiRequestInputSchema.parse(input)),
      'ApiRequest'
    )
  })

  ipcMain.handle(IpcChannels.API_VARIABLE_LIST, (_event, accessId: unknown) => {
    return repos.apiVariables.listByAccess(IdSchema.parse(accessId)).map(toPublicVariable)
  })

  ipcMain.handle(IpcChannels.API_VARIABLE_SET, (_event, raw: unknown) => {
    const input = SetApiVariableInputSchema.parse(raw)
    const existing = repos.apiVariables.getByKey(input.accessId, input.key)
    const isSecret = input.isSecret ?? existing?.isSecret ?? false

    if (isSecret) {
      const secret = input.value?.trim() ?? ''
      let credentialRef = existing?.credentialRef ?? null
      if (secret) {
        credentialRef = vault.setSecret(secret, credentialRef)
      }
      const saved = repos.apiVariables.upsert({
        accessId: input.accessId,
        key: input.key,
        isSecret: true,
        credentialRef,
        description: input.description,
        value: null
      })
      return toPublicVariable(saved)
    }

    if (existing?.credentialRef) {
      vault.deleteSecret(existing.credentialRef)
    }
    const saved = repos.apiVariables.upsert({
      accessId: input.accessId,
      key: input.key,
      isSecret: false,
      credentialRef: null,
      description: input.description,
      value: input.value ?? existing?.value ?? ''
    })
    return toPublicVariable(saved)
  })

  ipcMain.handle(IpcChannels.API_VARIABLE_DELETE, (_event, id: unknown) => {
    const variableId = IdSchema.parse(id)
    const existing = repos.apiVariables.get(variableId)
    if (!existing) {
      throw new Error('ApiVariable not found')
    }
    if (existing.credentialRef) {
      vault.deleteSecret(existing.credentialRef)
    }
    repos.apiVariables.delete(variableId)
  })
}
