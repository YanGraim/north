import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NATIVE_CHROME, TITLEBAR_OVERLAY_HEIGHT } from '@shared/lib/theme'
import { app, BrowserWindow, Notification, shell, type Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import { isQuitting, markQuitting } from './app-quit'
import { closeDatabase } from './database'
import { registerIpcHandlers } from './ipc/handlers'
import { disposeProtocolManager } from './ipc/sessions'
import { disposeVpn, hasActiveVpnTunnels, hasVpnProfiles } from './ipc/vpn'
import { createTray } from './tray'

// Must run before any app.getPath('userData') / DB access so paths match productName.
app.setName('North')

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
// kept here: a Tray that's garbage-collected disappears from the menu bar
let tray: Tray | null = null

/** Brings the window back from the tray (or creates it again on macOS). */
function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** First time the window goes to the tray: say North is still running there. */
function hintTray(): void {
  const flag = join(app.getPath('userData'), 'tray-hint-shown')
  if (existsSync(flag)) return
  writeFileSync(flag, '')
  new Notification({
    title: 'O North continua aberto',
    body:
      process.platform === 'darwin'
        ? 'Suas VPNs seguem conectadas. O North fica no ícone da barra de menus.'
        : 'Suas VPNs seguem conectadas. O North fica no ícone da bandeja, perto do relógio.'
  }).show()
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: NATIVE_CHROME.dark.overlayColor,
            symbolColor: NATIVE_CHROME.dark.overlaySymbol,
            height: TITLEBAR_OVERLAY_HEIGHT
          }
        }),
    backgroundColor: NATIVE_CHROME.dark.background,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = window

  window.on('ready-to-show', () => {
    window.show()
  })

  // with VPNs, closing the window keeps North (and its tunnels) running in the tray
  window.on('close', (event) => {
    if (isQuitting() || !hasVpnProfiles()) return
    event.preventDefault()
    window.hide()
    hintTray()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// one North: opening it again (shortcut, Dock, Start menu) brings back the one in the tray.
// Packaged only: the lock is per userData dir, which dev shares with the installed app
// (dev keeps its own north-dev.db), so `npm run dev` must not hand over to it.
const singleInstance = !app.isPackaged || app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
}

app.whenReady().then(() => {
  // the second copy only hands over to the first (second-instance) and quits
  if (!singleInstance) return
  if (process.platform === 'win32') {
    app.setAppUserModelId('app.north.desktop')
  }

  registerIpcHandlers()
  createWindow()
  tray = createTray({ open: showWindow, quit: () => app.quit() })

  app.on('activate', () => showWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let vpnShutdownDone = false

app.on('before-quit', (event) => {
  markQuitting()
  // Tunnels run as root — hold the quit until they're stopped over management,
  // otherwise they'd outlive North (boot cleanup is only the fallback).
  if (!vpnShutdownDone && hasActiveVpnTunnels()) {
    event.preventDefault()
    vpnShutdownDone = true
    void disposeVpn().finally(() => app.quit())
    return
  }
  void disposeProtocolManager().finally(() => {
    closeDatabase()
  })
})

app.on('will-quit', () => {
  tray?.destroy()
  tray = null
})
