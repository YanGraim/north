import { IpcChannels } from '@shared/ipc'
import { isThemePreference } from '@shared/lib/theme'
import { app, ipcMain } from 'electron'
import { isAppLocale } from '../close-to-tray'
import { getLaunchAtLogin, setLaunchAtLogin } from '../login-item'
import {
  getCloseToTrayState,
  readVpnNotifications,
  setAppLocale,
  setCloseToTray,
  setVpnNotifications
} from '../window-prefs'
import { applyAppTheme } from '../window-theme'
import { hasVpnProfiles } from './vpn'

export function registerThemeHandlers(): void {
  ipcMain.handle(IpcChannels.APP_SET_THEME, (_event, theme: unknown): void => {
    if (!isThemePreference(theme)) return
    applyAppTheme(theme)
  })
  ipcMain.handle(IpcChannels.APP_GET_LAUNCH_AT_LOGIN, (): boolean => getLaunchAtLogin())
  ipcMain.handle(IpcChannels.APP_SET_LAUNCH_AT_LOGIN, (_event, enabled: unknown): boolean =>
    setLaunchAtLogin(enabled === true)
  )
  ipcMain.handle(IpcChannels.APP_GET_CLOSE_TO_TRAY, () =>
    getCloseToTrayState(app.getPath('userData'), hasVpnProfiles())
  )
  ipcMain.handle(IpcChannels.APP_SET_CLOSE_TO_TRAY, (_event, enabled: unknown) =>
    setCloseToTray(app.getPath('userData'), enabled === true, hasVpnProfiles())
  )
  ipcMain.handle(IpcChannels.APP_SET_LOCALE, (_event, locale: unknown): void => {
    if (!isAppLocale(locale)) return
    setAppLocale(app.getPath('userData'), locale)
  })
  ipcMain.handle(IpcChannels.APP_GET_VPN_NOTIFICATIONS, (): boolean =>
    readVpnNotifications(app.getPath('userData'))
  )
  ipcMain.handle(IpcChannels.APP_SET_VPN_NOTIFICATIONS, (_event, enabled: unknown): boolean =>
    setVpnNotifications(app.getPath('userData'), enabled === true)
  )
}
