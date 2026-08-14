import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { describe, expect, it } from 'vitest'

/**
 * Cypress do harness mocka window.north — não pega preload Electron stale.
 * Este smoke garante que source de preload + handler main expõem cada canal workflows.
 */
describe('workflows IPC surface', () => {
  const root = resolve(__dirname, '../../..')
  const preloadSrc = readFileSync(resolve(root, 'src/preload/index.ts'), 'utf8')
  const handlersSrc = readFileSync(resolve(root, 'src/main/ipc/workflows.ts'), 'utf8')

  const required = [
    ['WORKFLOWS_LIST', 'list'],
    ['WORKFLOWS_GET', 'get'],
    ['WORKFLOWS_CREATE', 'create'],
    ['WORKFLOWS_COPY', 'copy'],
    ['WORKFLOWS_UPDATE', 'update'],
    ['WORKFLOWS_DELETE', 'delete']
  ] as const

  it('preload invokes every required workflows channel', () => {
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

  it('main registers WORKFLOWS_COPY handler', () => {
    expect(handlersSrc).toContain('IpcChannels.WORKFLOWS_COPY')
    expect(handlersSrc).toContain('copyWorkflow')
  })
})
