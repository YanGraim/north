import { IpcChannels } from '@shared/ipc'
import type { LogFollowSnapshot } from '@shared/types'
import { IdSchema, LogFollowStartInputSchema } from '@shared/types'
import { BrowserWindow, ipcMain } from 'electron'
import {
  closeAllLogFollowWindows,
  closeLogFollowWindow,
  focusLogFollowWindow,
  openLogFollowWindow,
  setLogFollowWindowClosedHandler,
  setLogFollowWindowTitle
} from '../log-follow-windows'
import { focusMainWindow } from '../main-window'
import { LogFollowService } from '../services/log-follow-service'
import { sshFollowConnector } from '../services/log-follow-ssh'
import { getProtocolManager } from './sessions'

let service: LogFollowService | null = null

function basename(path: string): string {
  const slash = path.lastIndexOf('/')
  const base = slash >= 0 ? path.slice(slash + 1) : path
  return base || path
}

function titleOf(follow: LogFollowSnapshot): string {
  return `${follow.connectionName} — ${follow.label?.trim() || basename(follow.path)}`
}

function publishBytes(chunk: { followId: string; seq: number; data: number[] }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.LOG_FOLLOWS_DATA, chunk)
  }
}

function publish(follows: LogFollowSnapshot[]): void {
  for (const follow of follows) {
    if (follow.placement === 'window') setLogFollowWindowTitle(follow.id, titleOf(follow))
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.LOG_FOLLOWS_CHANGED, follows)
  }
}

function parseId(value: unknown): string | null {
  const parsed = IdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function registerLogFollowHandlers(): void {
  const manager = getProtocolManager()
  service = new LogFollowService({
    load: (connectionId) => manager.openFollowTarget(connectionId),
    ensureVpn: (connection, followId) => manager.prepareFollowVpn(connection, followId),
    releaseVpn: (followId) => manager.releaseFollowVpn(followId),
    confirmHostKey: (followId, info) => manager.confirmHostKey(followId, info),
    focusMain: () => focusMainWindow(),
    focusWindow: (followId) => focusLogFollowWindow(followId),
    connector: sshFollowConnector,
    onChanged: publish,
    onBytes: (followId, seq, bytes) => {
      publishBytes({ followId, seq, data: Array.from(bytes) })
    },
    onReset: (followId) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IpcChannels.LOG_FOLLOWS_RESET, followId)
      }
    }
  })
  setLogFollowWindowClosedHandler((followId) => {
    void service?.stop(followId)
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_LIST, () => service?.list() ?? [])

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_START, async (_event, input: unknown) => {
    const parsed = LogFollowStartInputSchema.safeParse(input)
    if (!parsed.success || !service) return { ok: false as const, code: 'NOT_FOUND' as const }
    if ('path' in parsed.data) {
      return service.startPath(parsed.data.connectionId, parsed.data.path)
    }
    return service.start(parsed.data.connectionId, parsed.data.logFileId)
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_REPLAY, (_event, followId: unknown) => {
    const id = parseId(followId)
    if (!id || !service) return null
    return service.replay(id)
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_STOP, async (_event, followId: unknown) => {
    const id = parseId(followId)
    if (!id || !service) return
    await service.stop(id)
    closeLogFollowWindow(id, true)
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_RETRY, (_event, followId: unknown) => {
    const id = parseId(followId)
    if (!id || !service) return null
    return service.retry(id)
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_POP_OUT, (_event, followId: unknown) => {
    const id = parseId(followId)
    if (!id || !service) return null
    const snapshot = service.setPlacement(id, 'window')
    if (!snapshot) return null
    openLogFollowWindow(id, titleOf(snapshot))
    return snapshot
  })

  ipcMain.handle(IpcChannels.LOG_FOLLOWS_DOCK, (_event, followId: unknown) => {
    const id = parseId(followId)
    if (!id || !service) return null
    const snapshot = service.setPlacement(id, 'dock')
    if (!snapshot) return null
    closeLogFollowWindow(id, true)
    return snapshot
  })
}

export async function stopLogFollowsForConnection(connectionId: string): Promise<void> {
  if (!service) return
  const ids = service
    .list()
    .filter((follow) => follow.connectionId === connectionId)
    .map((follow) => follow.id)
  await service.stopConnection(connectionId)
  for (const id of ids) closeLogFollowWindow(id, true)
}

/** Drops follows whose connection disappeared (organization push or revoke). */
export async function reconcileLogFollows(): Promise<void> {
  if (!service) return
  const manager = getProtocolManager()
  const ids = service.list().map((follow) => follow.connectionId)
  for (const connectionId of ids) {
    const loaded = await manager.openFollowTarget(connectionId)
    if (!loaded) await stopLogFollowsForConnection(connectionId)
  }
}

export async function disposeLogFollows(): Promise<void> {
  await service?.disposeAll()
  closeAllLogFollowWindows()
  service = null
}
