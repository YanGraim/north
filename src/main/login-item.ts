import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { app } from 'electron'

/**
 * "Open North at login". The OS is the source of truth (the user can also turn it off in
 * Windows' Startup apps / macOS Login Items), so nothing is stored in North's DB.
 * macOS/Windows: Electron's login items. Linux: an XDG autostart .desktop file.
 */

export function linuxAutostartFile(home = homedir(), xdgConfig = process.env.XDG_CONFIG_HOME) {
  return join(xdgConfig || join(home, '.config'), 'autostart', 'north.desktop')
}

/** The AppImage moves the binary into a temp mount on each run: point at the .AppImage itself. */
export function linuxAutostartEntry(executable: string): string {
  const exec = /[\s"'\\]/.test(executable)
    ? `"${executable.replace(/(["\\$`])/g, '\\$1')}"`
    : executable
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=North',
    `Exec=${exec}`,
    'X-GNOME-Autostart-enabled=true',
    'Terminal=false',
    ''
  ].join('\n')
}

export function getLaunchAtLogin(): boolean {
  if (process.platform === 'linux') return existsSync(linuxAutostartFile())
  return app.getLoginItemSettings().openAtLogin
}

export function setLaunchAtLogin(enabled: boolean): boolean {
  if (process.platform === 'linux') {
    const file = linuxAutostartFile()
    if (enabled) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, linuxAutostartEntry(process.env.APPIMAGE || process.execPath))
    } else {
      rmSync(file, { force: true })
    }
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled })
  }
  return getLaunchAtLogin()
}
