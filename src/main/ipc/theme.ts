import { IpcChannels } from '@shared/ipc'
import { isThemePreference } from '@shared/lib/theme'
import { ipcMain } from 'electron'
import { applyAppTheme } from '../window-theme'

export function registerThemeHandlers(): void {
  ipcMain.handle(IpcChannels.APP_SET_THEME, (_event, theme: unknown): void => {
    if (!isThemePreference(theme)) return
    applyAppTheme(theme)
  })
}
