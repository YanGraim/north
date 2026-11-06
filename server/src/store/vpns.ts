import { randomUUID } from 'node:crypto'
import { VpnConfigSchema } from '@shared/types'
import { z } from 'zod'
import type { Db } from '../db'
import { iso, setClause } from './inventory'

type Row = Record<string, unknown>

/**
 * Kinds an organization can share. OpenVPN stays personal: a .ovpn file
 * often embeds the user's own certificate and key.
 */
const SHARED_KINDS = ['ipsec-ikev1', 'ipsec-ikev2', 'fortinet-sslvpn', 'windows-native'] as const

/** The gateway part of a VPN; the username is always dropped (each person signs in as themself). */
export const VpnTemplateConfigSchema = VpnConfigSchema.refine(
  (c) => (SHARED_KINDS as readonly string[]).includes(c.kind),
  { message: 'This kind of VPN cannot be shared with an organization' }
).transform((c) => ({ ...c, username: '' }))

export const CreateVpnTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  config: VpnTemplateConfigSchema,
  notes: z.string().max(10_000).nullable().optional()
})
export const UpdateVpnTemplateSchema = CreateVpnTemplateSchema.partial()

export type VpnTemplate = {
  id: string
  name: string
  kind: string
  config: z.infer<typeof VpnTemplateConfigSchema>
  notes: string | null
  createdAt: string
  updatedAt: string
}

const mapVpn = (r: Row): VpnTemplate => ({
  id: r.id as string,
  name: r.name as string,
  kind: r.kind as string,
  config: r.config as VpnTemplate['config'],
  notes: (r.notes as string | null) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at)
})

export async function listVpns(db: Db): Promise<VpnTemplate[]> {
  const { rows } = await db.query('SELECT * FROM vpns ORDER BY lower(name), created_at')
  return rows.map(mapVpn)
}

export async function getVpn(db: Db, id: string): Promise<VpnTemplate | null> {
  const { rows } = await db.query('SELECT * FROM vpns WHERE id = $1', [id])
  return rows[0] ? mapVpn(rows[0]) : null
}

export async function createVpn(
  db: Db,
  userId: string,
  input: z.infer<typeof CreateVpnTemplateSchema>
): Promise<VpnTemplate> {
  const { rows } = await db.query(
    `INSERT INTO vpns (id, name, kind, config, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      randomUUID(),
      input.name,
      input.config.kind,
      JSON.stringify(input.config),
      input.notes ?? null,
      userId
    ]
  )
  return mapVpn(rows[0])
}

export async function updateVpn(
  db: Db,
  id: string,
  input: z.infer<typeof UpdateVpnTemplateSchema>
): Promise<VpnTemplate | null> {
  const patch: Record<string, unknown> = { ...input }
  if (input.config) patch.kind = input.config.kind
  const set = setClause(
    patch,
    { name: 'name', kind: 'kind', config: 'config', notes: 'notes' },
    new Set(['config'])
  )
  const { rows } = await db.query(`UPDATE vpns SET ${set.sql} WHERE id = $1 RETURNING *`, [
    id,
    ...set.params
  ])
  return rows[0] ? mapVpn(rows[0]) : null
}

export async function deleteVpn(db: Db, id: string): Promise<boolean> {
  const { rows } = await db.query('DELETE FROM vpns WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

/** Which node uses which VPN, to show a person only the VPNs of what they can see. */
export async function vpnUses(
  db: Db
): Promise<
  Array<{ type: 'client' | 'environment' | 'connection' | 'access'; id: string; vpnId: string }>
> {
  const { rows } = await db.query<{ type: string; id: string; vpn_id: string }>(
    `SELECT 'client' AS type, id, vpn_id FROM clients WHERE vpn_id IS NOT NULL
     UNION ALL SELECT 'environment', id, vpn_id FROM environments WHERE vpn_id IS NOT NULL
     UNION ALL SELECT 'connection', id, vpn_id FROM connections WHERE vpn_id IS NOT NULL
     UNION ALL SELECT 'access', id, vpn_id FROM accesses WHERE vpn_id IS NOT NULL`
  )
  return rows.map((r) => ({
    type: r.type as 'client' | 'environment' | 'connection' | 'access',
    id: r.id,
    vpnId: r.vpn_id
  }))
}
