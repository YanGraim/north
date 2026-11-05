import { readFileSync } from 'node:fs'
import { Menu, Notification, nativeImage, systemPreferences, Tray } from 'electron'
import dotBusy2x from '../../resources/tray/dot-busy@2x.png?asset'
import dotBusy from '../../resources/tray/dot-busy.png?asset'
import dotOff2x from '../../resources/tray/dot-off@2x.png?asset'
import dotOff from '../../resources/tray/dot-off.png?asset'
import dotOn2x from '../../resources/tray/dot-on@2x.png?asset'
import dotOn from '../../resources/tray/dot-on.png?asset'
import trayIcon2x from '../../resources/tray/tray@2x.png?asset'
import trayIcon from '../../resources/tray/tray.png?asset'
import trayTemplate2x from '../../resources/tray/trayTemplate@2x.png?asset'
import trayTemplate from '../../resources/tray/trayTemplate.png?asset'
import { connectVpnFromTray, disconnectVpnFromTray, listVpnsForTray, onVpnChange } from './ipc/vpn'
import { decodePng, encodePng, type RgbaImage } from './png-rgba'
import { paintVpnBadge, tintGlyph, trayBadgeGlyph, trayBadgeUsesTemplate } from './tray-badge'
import { buildTrayMenu, type TrayDot, trayShowsVpnBadge, trayTooltip } from './tray-menu'

const DOTS: Record<TrayDot, [string, string]> = {
  on: [dotOn, dotOn2x],
  busy: [dotBusy, dotBusy2x],
  off: [dotOff, dotOff2x]
}

/** Colored on purpose (not a template): the color is the status, on every OS. */
function dot(kind: TrayDot) {
  const [path, path2x] = DOTS[kind]
  const image = nativeImage.createFromPath(path)
  image.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(path2x).toPNG() })
  return image
}

function icon() {
  // macOS: a template image, tinted by the system for light/dark menu bars
  const mac = process.platform === 'darwin'
  const image = nativeImage.createFromPath(mac ? trayTemplate : trayIcon)
  image.addRepresentation({
    scaleFactor: 2,
    buffer: nativeImage.createFromPath(mac ? trayTemplate2x : trayIcon2x).toPNG()
  })
  if (mac) image.setTemplateImage(true)
  return image
}

const decoded = new Map<string, RgbaImage>()

function rgbaFrom(file: string): RgbaImage {
  const cached = decoded.get(file)
  if (cached) return cached
  const image = decodePng(readFileSync(file))
  decoded.set(file, image)
  return image
}

const GLYPH = { black: { r: 0, g: 0, b: 0 }, white: { r: 255, g: 255, b: 255 } } as const

/** Colored N, or the macOS template recolored, plus one green ellipse. Not a template image. */
function vpnIcon(appleInterfaceStyle: string) {
  const mac = trayBadgeUsesTemplate(process.platform)
  const glyph = trayBadgeGlyph(process.platform, appleInterfaceStyle)
  const paint = (file: string): RgbaImage => {
    const src = rgbaFrom(file)
    const rgba = new Uint8Array(src.rgba)
    if (glyph !== 'keep') tintGlyph(rgba, GLYPH[glyph])
    paintVpnBadge(rgba, src.width, src.height)
    return { width: src.width, height: src.height, rgba }
  }
  const image = nativeImage.createFromBuffer(encodePng(paint(mac ? trayTemplate : trayIcon)))
  image.addRepresentation({
    scaleFactor: 2,
    buffer: encodePng(paint(mac ? trayTemplate2x : trayIcon2x))
  })
  // A template would tint the ellipse black or white along with the N.
  image.setTemplateImage(false)
  return image
}

/** System menu bar, not the app theme. Empty outside macOS. */
function appleInterfaceStyle(): string {
  if (process.platform !== 'darwin') return ''
  const value = systemPreferences.getUserDefault('AppleInterfaceStyle', 'string')
  return typeof value === 'string' ? value : ''
}

/** North's icon in the menu bar / notification area: VPNs one click away, window or not. */
export function createTray(window: { open: () => void; quit: () => void }): Tray {
  const tray = new Tray(icon())
  let iconKey = 'off'

  const refresh = () => {
    const vpns = listVpnsForTray()
    const badge = trayShowsVpnBadge(vpns)
    const appearance = badge ? appleInterfaceStyle() : ''
    const key = badge ? `on:${trayBadgeGlyph(process.platform, appearance)}` : 'off'
    if (key !== iconKey) {
      iconKey = key
      tray.setImage(badge ? vpnIcon(appearance) : icon())
    }
    tray.setToolTip(trayTooltip(vpns))
    tray.setContextMenu(
      Menu.buildFromTemplate(
        buildTrayMenu(vpns, {
          connect: (id) =>
            void connectVpnFromTray(id).then((error) => {
              if (!error) return
              // the window shows the details (certificate to trust, log…)
              new Notification({ title: 'VPN não conectou', body: error }).show()
              window.open()
            }),
          disconnect: (id) => void disconnectVpnFromTray(id),
          open: window.open,
          quit: window.quit,
          dot
        })
      )
    )
  }

  refresh()
  onVpnChange(refresh)
  if (process.platform === 'darwin') {
    systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
      refresh()
    })
  }
  // Windows/Linux: a left click opens the window (the menu is on the right click)
  if (process.platform !== 'darwin') tray.on('click', window.open)
  return tray
}
