import { Menu, Notification, nativeImage, Tray } from 'electron'
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
import { buildTrayMenu, type TrayDot, trayTooltip } from './tray-menu'

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

/** North's icon in the menu bar / notification area: VPNs one click away, window or not. */
export function createTray(window: { open: () => void; quit: () => void }): Tray {
  const tray = new Tray(icon())

  const refresh = () => {
    const vpns = listVpnsForTray()
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
  // Windows/Linux: a left click opens the window (the menu is on the right click)
  if (process.platform !== 'darwin') tray.on('click', window.open)
  return tray
}
