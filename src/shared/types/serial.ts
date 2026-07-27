import { z } from 'zod'

export const SerialPortInfoSchema = z.object({
  path: z.string().min(1),
  manufacturer: z.string().nullable(),
  serialNumber: z.string().nullable(),
  vendorId: z.string().nullable(),
  productId: z.string().nullable()
})

export type SerialPortInfo = z.infer<typeof SerialPortInfoSchema>

export const SERIAL_BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600
] as const
