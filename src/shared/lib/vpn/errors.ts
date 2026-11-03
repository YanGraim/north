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

export const COMPONENT_FAILURE_CODES = [
  'PRIVILEGE_DENIED',
  'BINARY_MISSING',
  'DRIVER_CRASHED'
] as const
export type ComponentFailureCode = (typeof COMPONENT_FAILURE_CODES)[number]

/**
 * Cancel signals already used by SudoPromptBroker, plus the Windows UAC dismissal.
 * "Access is denied" is intentionally absent: Windows uses it for a locked file too.
 */
const PRIVILEGE_DENIED_SIGNAL =
  /did not grant permission|Request dismissed|cancel|canceled by the user/i

export function isComponentFailureCode(code: VpnErrorCode): code is ComponentFailureCode {
  return (COMPONENT_FAILURE_CODES as readonly string[]).includes(code)
}

/**
 * Install/remove failures the VPNs page can explain. A VpnError that already carries one of
 * the three codes keeps it (`BINARY_MISSING` is never inferred from a path in the text).
 * Any other VpnError code collapses to `DRIVER_CRASHED`. A raw process error becomes
 * `PRIVILEGE_DENIED` only on a cancel signal.
 */
export function classifyComponentFailure(error: unknown): ComponentFailureCode {
  const code = readVpnErrorCode(error)
  if (code && isComponentFailureCode(code)) return code
  if (code) return 'DRIVER_CRASHED'
  if (PRIVILEGE_DENIED_SIGNAL.test(errorMessage(error))) return 'PRIVILEGE_DENIED'
  return 'DRIVER_CRASHED'
}

function readVpnErrorCode(error: unknown): VpnErrorCode | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const parsed = VpnErrorCodeSchema.safeParse(error.code)
  return parsed.success ? parsed.data : null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}
