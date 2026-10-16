import { type VpnErrorCode, VpnErrorCodeSchema } from '@shared/types'

/** IPC rejections only carry a message — encode the code so the UI can pick the right action. */
export function formatVpnErrorMessage(code: VpnErrorCode, message: string): string {
  return `[VPN:${code}] ${message}`
}

export function parseVpnErrorMessage(raw: string): { code: VpnErrorCode; message: string } | null {
  const match = /\[VPN:([A-Z_]+)\] (.*)$/s.exec(raw)
  if (!match) return null
  const code = VpnErrorCodeSchema.safeParse(match[1])
  return code.success ? { code: code.data, message: match[2] } : null
}
