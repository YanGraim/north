import { join } from 'node:path'
import { NATIVE_CHROME, TITLEBAR_OVERLAY_HEIGHT } from '@shared/lib/theme'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { closeDatabase } from './database'
import { registerIpcHandlers } from './ipc/handlers'
import { disposeProtocolManager } from './ipc/sessions'

// Must run before any app.getPath('userData') / DB access so paths match productName.
app.setName('North')

const isDev = !app.isPackaged

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('app.north.desktop')
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void disposeProtocolManager().finally(() => {
    closeDatabase()
  })
})
