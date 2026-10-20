import { IpcChannels } from '@shared/ipc'
import { isThemePreference } from '@shared/lib/theme'
import { ipcMain } from 'electron'
import { getLaunchAtLogin, setLaunchAtLogin } from '../login-item'
import { applyAppTheme } from '../window-theme'

export function registerThemeHandlers(): void {
  ipcMain.handle(IpcChannels.APP_SET_THEME, (_event, theme: unknown): void => {
    if (!isThemePreference(theme)) return
    applyAppTheme(theme)
  })
  ipcMain.handle(IpcChannels.APP_GET_LAUNCH_AT_LOGIN, (): boolean => getLaunchAtLogin())
  ipcMain.handle(IpcChannels.APP_SET_LAUNCH_AT_LOGIN, (_event, enabled: unknown): boolean =>
    setLaunchAtLogin(enabled === true)
  )
}
