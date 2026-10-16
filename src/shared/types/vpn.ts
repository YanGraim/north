import { z } from 'zod'
import { IdSchema, IsoDateSchema } from './client'

export const VpnKindSchema = z.enum(['openvpn', 'ipsec-ikev1', 'ipsec-ikev2', 'fortinet-sslvpn'])
export type VpnKind = z.infer<typeof VpnKindSchema>

export const VpnSecretKindSchema = z.enum([
  'password',
  'key-passphrase',
  'psk',
  'private-key',
  'ovpn-inline'
])
export type VpnSecretKind = z.infer<typeof VpnSecretKindSchema>

/** How a Connection/Access picks its VPN: inherit from env/client, none, or an explicit profile. */
export const VpnModeSchema = z.enum(['inherit', 'none', 'profile'])
export type VpnMode = z.infer<typeof VpnModeSchema>

export const VpnAutoDisconnectSchema = z.enum(['when-idle', 'never'])
export type VpnAutoDisconnect = z.infer<typeof VpnAutoDisconnectSchema>

export const VpnRemoteSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  proto: z.enum(['udp', 'tcp'])
})
export type VpnRemote = z.infer<typeof VpnRemoteSchema>

/** `config` never carries secrets — inline key blocks live in the vault (`ovpn-inline`). */
export const OpenVpnConfigSchema = z.object({
  kind: z.literal('openvpn'),
  ovpn: z.string().min(1),
  requiresUserPass: z.boolean(),
  requiresKeyPassphrase: z.boolean(),
  username: z.string().optional(),
  remoteSummary: z.array(VpnRemoteSchema),
  redirectGateway: z.boolean(),
  declaredRoutes: z.array(z.string())
})

export const IpsecIkev1ConfigSchema = z.object({
  kind: z.literal('ipsec-ikev1'),
  gateway: z.string().min(1),
  groupName: z.string().optional(),
  username: z.string().min(1),
  xauth: z.enum(['saved', 'prompt'])
})

export const IpsecIkev2ConfigSchema = z.object({
  kind: z.literal('ipsec-ikev2'),
  gateway: z.string().min(1),
  remoteId: z.string().optional(),
  username: z.string().min(1),
  auth: z.enum(['eap', 'psk'])
})

/** FortiGate SSL-VPN (FortiClient's "SSL-VPN" tab), driven through openfortivpn. */
export const FortinetSslVpnConfigSchema = z.object({
  kind: z.literal('fortinet-sslvpn'),
  gateway: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  realm: z.string().optional(),
  /** sha256 of the gateway certificate the user explicitly trusted (self-signed FortiGates). */
  trustedCert: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional()
})

export const VpnConfigSchema = z.discriminatedUnion('kind', [
  OpenVpnConfigSchema,
  IpsecIkev1ConfigSchema,
  IpsecIkev2ConfigSchema,
  FortinetSslVpnConfigSchema
])
export type VpnConfig = z.infer<typeof VpnConfigSchema>
export type OpenVpnConfig = z.infer<typeof OpenVpnConfigSchema>

export const VpnProfileSchema = z.object({
  id: IdSchema,
  clientId: IdSchema.nullable(),
  name: z.string().min(1),
  kind: VpnKindSchema,
  config: VpnConfigSchema,
  autoDisconnect: VpnAutoDisconnectSchema,
  idleTimeoutSec: z.number().int().min(0),
  notes: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema
})
export type VpnProfile = z.infer<typeof VpnProfileSchema>

export const CreateVpnProfileInputSchema = z.object({
  clientId: IdSchema.nullable().optional(),
  name: z.string().trim().min(1),
  config: VpnConfigSchema,
  autoDisconnect: VpnAutoDisconnectSchema.optional(),
  idleTimeoutSec: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional()
})
export type CreateVpnProfileInput = z.infer<typeof CreateVpnProfileInputSchema>

export const UpdateVpnProfileInputSchema = CreateVpnProfileInputSchema.partial()
export type UpdateVpnProfileInput = z.infer<typeof UpdateVpnProfileInputSchema>

export const SetVpnSecretInputSchema = z.object({
  profileId: IdSchema,
  kind: VpnSecretKindSchema,
  /** Empty string = delete the secret. */
  secret: z.string()
})
export type SetVpnSecretInput = z.infer<typeof SetVpnSecretInputSchema>

export const VpnStatusSchema = z.enum([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'disconnecting',
  'error'
])
export type VpnStatus = z.infer<typeof VpnStatusSchema>

export const VpnErrorCodeSchema = z.enum([
  'AUTH_FAILED',
  'KEY_PASSPHRASE_WRONG',
  'TIMEOUT',
  'HOST_UNREACHABLE',
  'PRIVILEGE_DENIED',
  'BINARY_MISSING',
  'CONFLICT',
  'UNSUPPORTED_ON_PLATFORM',
  'DRIVER_CRASHED',
  'SECRET_MISSING',
  'INVALID_CONFIG',
  'CONNECTION_REJECTED',
  'PROFILE_APPROVAL_REQUIRED',
  'CERT_UNTRUSTED'
])
export type VpnErrorCode = z.infer<typeof VpnErrorCodeSchema>

export const VpnTriggerSchema = z.enum(['manual', 'auto'])
export type VpnTrigger = z.infer<typeof VpnTriggerSchema>

export const VpnStateSchema = z.object({
  profileId: IdSchema,
  status: VpnStatusSchema,
  since: IsoDateSchema,
  localIp: z.string().optional(),
  routes: z.array(z.string()).optional(),
  lastError: z
    .object({
      code: VpnErrorCodeSchema,
      message: z.string(),
      /** CERT_UNTRUSTED: the digest to show and, if the user agrees, trust. */
      certDigest: z.string().optional()
    })
    .optional(),
  leases: z.number().int().min(0),
  trigger: VpnTriggerSchema.nullable(),
  reconnectAttempt: z.number().int().min(0).optional(),
  /** Human progress hint while connecting (e.g. "approve the profile in System Settings"). */
  detail: z.string().optional(),
  /** Monotonic per-manager counter so the renderer can drop out-of-order events. */
  version: z.number().int()
})
export type VpnState = z.infer<typeof VpnStateSchema>

export const VpnConflictSchema = z.object({
  type: z.enum(['overlapping-routes', 'full-tunnel', 'platform-single-ipsec']),
  withProfileId: IdSchema,
  detail: z.string().optional()
})
export type VpnConflict = z.infer<typeof VpnConflictSchema>

export const VpnConnectInputSchema = z.object({
  profileId: IdSchema,
  /** Skip the conflict check (user picked "connect anyway"). */
  force: z.boolean().optional()
})
export type VpnConnectInput = z.infer<typeof VpnConnectInputSchema>

export const VpnPlatformSupportSchema = z.record(
  VpnKindSchema,
  z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), reason: z.string() })
  ])
)
export type VpnPlatformSupport = z.infer<typeof VpnPlatformSupportSchema>

export const ImportOvpnInputSchema = z.object({
  content: z.string().min(1).max(1_000_000),
  name: z.string().trim().min(1).optional(),
  clientId: IdSchema.nullable().optional(),
  /** Replace this profile's .ovpn (keeps name, client, links and saved password). */
  profileId: IdSchema.optional()
})
export type ImportOvpnInput = z.infer<typeof ImportOvpnInputSchema>

/**
 * Import creates the profile right away so inline key blocks can go straight to
 * the vault — they never round-trip through the renderer.
 */
export const OvpnImportResultSchema = z.object({
  profile: VpnProfileSchema,
  /** Which secret inline blocks were moved to the vault (names only). */
  inlineBlocks: z.array(z.string())
})
export type OvpnImportResult = z.infer<typeof OvpnImportResultSchema>

export const VpnHistoryEntrySchema = z.object({
  id: IdSchema,
  vpnProfileId: IdSchema,
  startedAt: IsoDateSchema,
  endedAt: IsoDateSchema.nullable(),
  trigger: VpnTriggerSchema,
  result: z.enum(['pending', 'connected', 'error', 'cancelled']),
  errorCode: VpnErrorCodeSchema.nullable()
})
export type VpnHistoryEntry = z.infer<typeof VpnHistoryEntrySchema>

/** Which secrets are stored for a profile — never the values. */
export const VpnSecretStatusSchema = z.record(VpnSecretKindSchema, z.boolean())
export type VpnSecretStatus = z.infer<typeof VpnSecretStatusSchema>
