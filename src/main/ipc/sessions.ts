import { IpcChannels } from '@shared/ipc'
import { ListDirectoryArgsSchema } from '@shared/lib/list-directory'
import { ClassifyPathArgsSchema } from '@shared/lib/selection-path'
import { coerceBytes, type HostKeyResponse, type SessionPortMessage } from '@shared/protocols'
import { BrowserWindow, ipcMain } from 'electron'
import { FtpDriver } from '../protocols/ftp-driver'
import { RdpDriver } from '../protocols/rdp-driver'
import { SerialDriver } from '../protocols/serial-driver'
import { SftpDriver } from '../protocols/sftp-driver'
import { SshDriver } from '../protocols/ssh-driver'
import { TelnetDriver } from '../protocols/telnet-driver'
import { VncDriver } from '../protocols/vnc-driver'
import type { Repositories } from '../repositories'
import { ProtocolManager } from '../services/protocol-manager'
import type { CredentialVault } from '../vault'

let protocolManager: ProtocolManager | null = null

export function getProtocolManager(): ProtocolManager {
  if (!protocolManager) {
    throw new Error('ProtocolManager not initialized')
  }
  return protocolManager
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function encodeStdoutPayload(message: SessionPortMessage): unknown {
  if (message.type !== 'data') return message
  const bytes = coerceBytes(message.data)
  if (!bytes) return null
  // number[] survives IPC + contextBridge without TypedArray instanceof issues
  return { type: 'data', data: Array.from(bytes) }
}

export function registerSessionHandlers(repositories: Repositories, vault: CredentialVault): void {
  protocolManager = new ProtocolManager(repositories, vault)
  protocolManager.register(new SshDriver())
  protocolManager.register(new SftpDriver())
  protocolManager.register(new FtpDriver())
  protocolManager.register(new TelnetDriver())
  protocolManager.register(new SerialDriver())
  protocolManager.register(new VncDriver())
  protocolManager.register(new RdpDriver())
  protocolManager.setEvents({
    onStateChanged: (descriptor) => {
      broadcast(IpcChannels.SESSIONS_STATE_CHANGED, descriptor)
    },
    onHostKeyPrompt: (prompt) => {
      broadcast(IpcChannels.SESSIONS_HOST_KEY_PROMPT, prompt)
    },
    onSessionMessage: (sessionId, message) => {
      if (message.type === 'data') {
        const payload = encodeStdoutPayload(message)
        if (payload) {
          broadcast(IpcChannels.SESSIONS_STDOUT, { sessionId, message: payload })
        }
        return
      }
      broadcast(IpcChannels.SESSIONS_STDOUT, { sessionId, message })
    }
  })

  ipcMain.handle(
    IpcChannels.SESSIONS_OPEN,
    async (event, connectionId: string, requestId: string, as?: unknown) => {
      const { descriptor, port } = await protocolManager!.open(
        connectionId,
        requestId,
        as === 'sftp' ? 'sftp' : undefined
      )
      event.sender.postMessage(IpcChannels.SESSIONS_PORT, { requestId, sessionId: descriptor.id }, [
        port
      ])
      return descriptor
    }
  )

  ipcMain.handle(IpcChannels.SESSIONS_OPEN_ACCESS, async (_event, accessId: string) => {
    const { descriptor } = await protocolManager!.openAccess(accessId)
    return descriptor
  })

  ipcMain.handle(IpcChannels.SESSIONS_OPEN_LOCAL, async (event, requestId: string) => {
    const { descriptor, port } = await protocolManager!.openLocal()
    event.sender.postMessage(IpcChannels.SESSIONS_PORT, { requestId, sessionId: descriptor.id }, [
      port
    ])
    return descriptor
  })

  ipcMain.handle(
    IpcChannels.SESSIONS_OPEN_AGENT_WORKSPACE,
    async (event, workspaceId: string, requestId: string) => {
      const { descriptor, port } = await protocolManager!.openAgentWorkspace(workspaceId)
      event.sender.postMessage(IpcChannels.SESSIONS_PORT, { requestId, sessionId: descriptor.id }, [
        port
      ])
      return descriptor
    }
  )

  ipcMain.handle(IpcChannels.SESSIONS_CLOSE, async (_event, sessionId: string) => {
    await protocolManager!.close(sessionId)
  })

  ipcMain.handle(IpcChannels.SESSIONS_LIST, () => {
    return protocolManager!.list()
  })

  ipcMain.handle(IpcChannels.SESSIONS_RESPOND_HOST_KEY, (_event, response: HostKeyResponse) => {
    protocolManager!.respondHostKey(response)
  })

  ipcMain.handle(IpcChannels.SESSIONS_CLAUDE_USAGE, (_event, sessionId: string) => {
    return protocolManager?.getClaudeUsage(sessionId) ?? null
  })

  ipcMain.handle(IpcChannels.SESSIONS_LIST_DIRECTORY, async (_event, input: unknown) => {
    const invalid = { ok: false as const, reason: 'invalid' as const }
    const unavailable = { ok: false as const, reason: 'unavailable' as const }
    const parsed = ListDirectoryArgsSchema.safeParse(input)
    if (!parsed.success || !protocolManager) return invalid
    try {
      return await protocolManager.listDirectory(parsed.data.sessionId, parsed.data.path)
    } catch {
      return unavailable
    }
  })

  ipcMain.handle(IpcChannels.SESSIONS_CLASSIFY_PATH, async (_event, input: unknown) => {
    const unavailable = { kind: 'unavailable' as const, path: '', absolute: null }
    const parsed = ClassifyPathArgsSchema.safeParse(input)
    if (!parsed.success || !protocolManager) return unavailable
    try {
      return await protocolManager.classifyPath(parsed.data.sessionId, parsed.data.path)
    } catch {
      return unavailable
    }
  })

  ipcMain.on(IpcChannels.SESSIONS_STDIN, (_event, sessionId: string, data: unknown) => {
    protocolManager?.writeStdin(sessionId, data)
  })

  ipcMain.on(
    IpcChannels.SESSIONS_RESIZE,
    (_event, sessionId: string, cols: number, rows: number) => {
      protocolManager?.resize(sessionId, cols, rows)
    }
  )

  ipcMain.on(IpcChannels.SESSIONS_STDOUT_READY, (_event, sessionId: string) => {
    protocolManager?.markStdoutReady(sessionId)
  })
}

export async function disposeProtocolManager(): Promise<void> {
  if (protocolManager) {
    await protocolManager.disposeAll()
    protocolManager = null
  }
}
