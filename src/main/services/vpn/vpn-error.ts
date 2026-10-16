import type { VpnConflict, VpnErrorCode } from '@shared/types'

export class VpnError extends Error {
  constructor(
    readonly code: VpnErrorCode,
    message: string,
    readonly conflicts?: VpnConflict[]
  ) {
    super(message)
    this.name = 'VpnError'
  }
}

export function toVpnError(error: unknown): VpnError {
  if (error instanceof VpnError) return error
  return new VpnError('DRIVER_CRASHED', error instanceof Error ? error.message : String(error))
}
