import { IpcChannels } from '@shared/ipc'
import type { SerialPortInfo } from '@shared/types'
import { ipcMain } from 'electron'
import { SerialPort } from 'serialport'

export function registerSerialHandlers(): void {
  ipcMain.handle(IpcChannels.SERIAL_LIST_PORTS, async (): Promise<SerialPortInfo[]> => {
    const ports = await SerialPort.list()
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer ?? null,
      serialNumber: port.serialNumber ?? null,
      vendorId: port.vendorId ?? null,
      productId: port.productId ?? null
    }))
  })
}
