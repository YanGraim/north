import { join } from 'node:path'
import { NATIVE_CHROME } from '@shared/lib/theme'
import { app, BrowserWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { wakeNativeWindows } from './window-theme'

const windows = new Map<string, BrowserWindow>()
const docking = new Set<string>()
let onClosed: (followId: string) => void = () => undefined

const isDev = !app.isPackaged

/** OS close ends the follow. Closing because the user docked it does not. */
export function setLogFollowWindowClosedHandler(handler: (followId: string) => void): void {
  onClosed = handler
}

export function openLogFollowWindow(followId: string, title: string): void {
  const existing = windows.get(followId)
  if (existing && !existing.isDestroyed()) {
    existing.setTitle(title)
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 520,
    height: 420,
    minWidth: 320,
    minHeight: 200,
    show: false,
    title,
    autoHideMenuBar: true,
    backgroundColor: NATIVE_CHROME.dark.background,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  windows.set(followId, win)
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    wakeNativeWindows()
  })
  win.on('closed', () => {
    windows.delete(followId)
    if (docking.delete(followId)) return
    onClosed(followId)
  })

  const hash = `/log-follow/${followId}`
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

export function focusLogFollowWindow(followId: string): void {
  const win = windows.get(followId)
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function setLogFollowWindowTitle(followId: string, title: string): void {
  const win = windows.get(followId)
  if (!win || win.isDestroyed()) return
  win.setTitle(title)
}

/** `becauseDock` keeps the SSH session when the window goes away. */
export function closeLogFollowWindow(followId: string, becauseDock: boolean): void {
  const win = windows.get(followId)
  if (!win || win.isDestroyed()) return
  if (becauseDock) docking.add(followId)
  win.close()
}

export function closeAllLogFollowWindows(): void {
  for (const [followId, win] of windows) {
    if (win.isDestroyed()) continue
    docking.add(followId)
    win.close()
  }
}
