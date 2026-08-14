import { z } from 'zod'

export const SessionKindSchema = z.enum(['terminal', 'desktop', 'file-transfer', 'database'])
export type SessionKind = z.infer<typeof SessionKindSchema>

export const SessionStateSchema = z.enum([
  'connecting',
  'connected',
  'reconnecting',
  'closed',
  'error'
])
export type SessionState = z.infer<typeof SessionStateSchema>

export const SessionDescriptorSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid().nullable(),
  accessId: z.string().uuid().nullable().optional(),
  kind: SessionKindSchema,
  protocol: z.string().min(1),
  title: z.string().min(1),
  state: SessionStateSchema,
  errorMessage: z.string().nullable().optional()
})
export type SessionDescriptor = z.infer<typeof SessionDescriptorSchema>

/** Plano de dados no MessagePort (renderer ↔ main). */
export const SessionPortMessageTypeSchema = z.enum([
  'data',
  'resize',
  'state',
  'error',
  'desktop-auth'
])
export type SessionPortMessageType = z.infer<typeof SessionPortMessageTypeSchema>

export type SessionDataMessage = {
  type: 'data'
  /** Base64 ou ArrayBuffer transferido — no wire usamos Uint8Array via structured clone. */
  data: ArrayBuffer | Uint8Array
}

export type SessionResizeMessage = {
  type: 'resize'
  cols: number
  rows: number
}

export type SessionStateMessage = {
  type: 'state'
  state: SessionState
  errorMessage?: string | null
}

export type SessionErrorMessage = {
  type: 'error'
  message: string
}

/**
 * Entrega one-shot de credenciais para sessão de desktop remoto (VNC/RDP).
 *
 * EXCEÇÃO DOCUMENTADA à regra "renderer nunca recebe segredos":
 * clientes de desktop remoto (noVNC, IronRDP) executam o handshake dentro
 * do renderer e precisam da senha em texto claro. O segredo é resolvido no
 * main via vault e enviado UMA ÚNICA VEZ pelo `MessagePort` dedicado da
 * sessão — nunca por `invoke`/broadcast/`window.north`. O renderer deve
 * descartar o segredo da memória assim que o handshake terminar.
 */
export type SessionDesktopAuthMessage = {
  type: 'desktop-auth'
  username?: string | null
  password: string
  domain?: string | null
}

export type SessionPortMessage =
  | SessionDataMessage
  | SessionResizeMessage
  | SessionStateMessage
  | SessionErrorMessage
  | SessionDesktopAuthMessage

export const HostKeyPromptSchema = z.object({
  requestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  host: z.string().min(1),
  port: z.number().int().positive(),
  keyType: z.string().min(1),
  fingerprint: z.string().min(1),
  previousFingerprint: z.string().nullable(),
  isMismatch: z.boolean()
})
export type HostKeyPrompt = z.infer<typeof HostKeyPromptSchema>

export const HostKeyResponseSchema = z.object({
  requestId: z.string().uuid(),
  accept: z.boolean()
})
export type HostKeyResponse = z.infer<typeof HostKeyResponseSchema>

export const OpenSessionInputSchema = z.object({
  connectionId: z.string().uuid()
})
export type OpenSessionInput = z.infer<typeof OpenSessionInputSchema>
