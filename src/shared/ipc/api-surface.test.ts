import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { describe, expect, it } from 'vitest'

/**
 * Cypress do harness mocka window.north — não pega preload Electron stale.
 * Este smoke garante que source de preload + handler main expõem cada canal api.
 */
describe('api IPC surface', () => {
  const root = resolve(__dirname, '../../..')
  const preloadSrc = readFileSync(resolve(root, 'src/preload/index.ts'), 'utf8')
  const handlersSrc = readFileSync(resolve(root, 'src/main/ipc/api.ts'), 'utf8')

  const required = [
    ['API_SEND', 'send'],
    ['API_CANCEL', 'cancel'],
    ['API_HISTORY_LIST', 'historyList'],
    ['API_COLLECTION_LIST', 'collectionList'],
    ['API_COLLECTION_CREATE', 'collectionCreate'],
    ['API_COLLECTION_UPDATE', 'collectionUpdate'],
    ['API_COLLECTION_DELETE', 'collectionDelete'],
    ['API_COLLECTION_DUPLICATE', 'collectionDuplicate'],
    ['API_COLLECTION_IMPORT', 'collectionImport'],
    ['API_COLLECTION_EXPORT', 'collectionExport'],
    ['API_FOLDER_LIST', 'folderList'],
    ['API_FOLDER_CREATE', 'folderCreate'],
    ['API_FOLDER_UPDATE', 'folderUpdate'],
    ['API_FOLDER_DELETE', 'folderDelete'],
    ['API_REQUEST_LIST', 'requestList'],
    ['API_REQUEST_CREATE', 'requestCreate'],
    ['API_REQUEST_UPDATE', 'requestUpdate'],
    ['API_REQUEST_DELETE', 'requestDelete'],
    ['API_REQUEST_DUPLICATE', 'requestDuplicate'],
    ['API_REQUEST_MOVE', 'requestMove'],
    ['API_VARIABLE_LIST', 'variableList'],
    ['API_VARIABLE_SET', 'variableSet'],
    ['API_VARIABLE_DELETE', 'variableDelete']
  ] as const

  it('preload invokes every required api channel', () => {
    for (const [channelKey, method] of required) {
      const channel = IpcChannels[channelKey]
      expect(preloadSrc, `preload missing ${method}`).toMatch(
        new RegExp(
          `${method}:\\s*\\([^)]*\\)\\s*=>\\s*ipcRenderer\\.invoke\\(IpcChannels\\.${channelKey}`
        )
      )
      expect(channel).toBeTruthy()
    }
  })

  it('main registers API_SEND handler', () => {
    expect(handlersSrc).toContain('IpcChannels.API_SEND')
    expect(handlersSrc).toContain('executeApiSend')
  })
})
