import { Menu, Notification, nativeImage, Tray } from 'electron'
import trayIcon2x from '../../resources/tray/tray@2x.png?asset'
import trayIcon from '../../resources/tray/tray.png?asset'
import trayTemplate2x from '../../resources/tray/trayTemplate@2x.png?asset'
import trayTemplate from '../../resources/tray/trayTemplate.png?asset'
import { connectVpnFromTray, disconnectVpnFromTray, listVpnsForTray, onVpnChange } from './ipc/vpn'
import { buildTrayMenu, trayTooltip } from './tray-menu'

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
          quit: window.quit
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
