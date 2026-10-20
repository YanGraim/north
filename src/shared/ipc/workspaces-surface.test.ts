import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { IpcChannels } from '@shared/ipc'
import { describe, expect, it } from 'vitest'

describe('workspaces IPC surface', () => {
  const root = resolve(__dirname, '../../..')
  const preloadSrc = readFileSync(resolve(root, 'src/preload/index.ts'), 'utf8')
  const handlersSrc = readFileSync(resolve(root, 'src/main/ipc/workspaces.ts'), 'utf8')
  const mockSrc = readFileSync(resolve(root, 'e2e-harness/mock-north.ts'), 'utf8')

  const required = [
    ['WORKSPACES_LIST', 'list', 'workspaces:list'],
    ['WORKSPACES_ACTIVATE', 'activate', 'workspaces:activate'],
    ['WORKSPACES_PROBE', 'probe', 'workspaces:probe'],
    ['WORKSPACES_ADD_ORGANIZATION', 'addOrganization', 'workspaces:add-organization'],
    ['WORKSPACES_REMOVE', 'remove', 'workspaces:remove']
  ] as const

  it.each(required)('%s uses the domain:action value %s', (key, _method, value) => {
    expect(IpcChannels[key]).toBe(value)
  })

  it.each(required)('preload invokes %s', (key, method) => {
    expect(preloadSrc).toMatch(
      new RegExp(`${method}:\\s*\\([^)]*\\)\\s*=>\\s*ipcRenderer\\.invoke\\(IpcChannels\\.${key}`)
    )
  })

  it.each(required)('main registers %s', (key) => {
    expect(handlersSrc).toContain(`ipcMain.handle(IpcChannels.${key}`)
  })

  it('never returns tokens to the renderer', () => {
    expect(handlersSrc).not.toMatch(/refreshToken|accessToken/)
  })

  it('the e2e mock implements the workspaces namespace', () => {
    expect(mockSrc).toMatch(/workspaces: workspacesMock/)
  })
})
