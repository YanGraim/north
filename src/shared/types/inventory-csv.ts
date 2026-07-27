import { z } from 'zod'
import { DatabaseEngineSchema } from './access'
import { ConnectionProtocolSchema } from './connection'

/** Discriminator column values in the CSV template. */
export const CsvRowTipoSchema = z.enum(['servidor', 'banco', 'login'])

export type CsvRowTipo = z.infer<typeof CsvRowTipoSchema>

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function coercePort(value: string | undefined): number | null | 'invalid' {
  const cleaned = emptyToNull(value)
  if (cleaned === null) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return 'invalid'
  return n
}

/** Normalize a CSV record into typed-ish fields before Zod. */
export function normalizeCsvRecord(record: Record<string, string>): {
  tipo: string | null
  cliente: string | null
  ambiente: string | null
  grupo: string | null
  nome: string | null
  protocolo: string | null
  engine: string | null
  host: string | null
  porta: number | null | 'invalid'
  database: string | null
  url: string | null
  usuario: string | null
  senha: string | null
  notas: string | null
  tags: string | null
} {
  return {
    tipo: emptyToNull(record.tipo)?.toLowerCase() ?? null,
    cliente: emptyToNull(record.cliente),
    ambiente: emptyToNull(record.ambiente),
    grupo: emptyToNull(record.grupo),
    nome: emptyToNull(record.nome),
    protocolo: emptyToNull(record.protocolo)?.toLowerCase() ?? null,
    engine: emptyToNull(record.engine)?.toLowerCase() ?? null,
    host: emptyToNull(record.host),
    porta: coercePort(record.porta),
    database: emptyToNull(record.database),
    url: emptyToNull(record.url),
    usuario: emptyToNull(record.usuario),
    senha: emptyToNull(record.senha),
    notas: emptyToNull(record.notas),
    tags: emptyToNull(record.tags)
  }
}

export const CsvServidorRowSchema = z.object({
  tipo: z.literal('servidor'),
  cliente: z.string().min(1),
  ambiente: z.string().min(1),
  grupo: z.string().min(1),
  nome: z.string().min(1),
  protocolo: ConnectionProtocolSchema,
  host: z.string().min(1),
  porta: z.number().int().positive().optional(),
  usuario: z.string().min(1).optional(),
  senha: z.string().min(1).optional(),
  notas: z.string().min(1).optional(),
  tags: z.string().min(1).optional()
})

export const CsvBancoRowSchema = z.object({
  tipo: z.literal('banco'),
  cliente: z.string().min(1),
  ambiente: z.string().min(1),
  grupo: z.string().min(1),
  nome: z.string().min(1),
  engine: DatabaseEngineSchema,
  host: z.string().min(1),
  porta: z.number().int().positive().optional(),
  database: z.string().min(1).optional(),
  usuario: z.string().min(1).optional(),
  senha: z.string().min(1).optional(),
  notas: z.string().min(1).optional(),
  tags: z.string().min(1).optional()
})

export const CsvLoginRowSchema = z.object({
  tipo: z.literal('login'),
  cliente: z.string().min(1),
  ambiente: z.string().min(1),
  grupo: z.string().min(1),
  nome: z.string().min(1),
  url: z.string().min(1),
  usuario: z.string().min(1),
  senha: z.string().min(1).optional(),
  notas: z.string().min(1).optional(),
  tags: z.string().min(1).optional()
})

export const InventoryCsvRowSchema = z.discriminatedUnion('tipo', [
  CsvServidorRowSchema,
  CsvBancoRowSchema,
  CsvLoginRowSchema
])

export type InventoryCsvRow = z.infer<typeof InventoryCsvRowSchema>
export type CsvServidorRow = z.infer<typeof CsvServidorRowSchema>
export type CsvBancoRow = z.infer<typeof CsvBancoRowSchema>
export type CsvLoginRow = z.infer<typeof CsvLoginRowSchema>

export const CSV_TEMPLATE_FILENAME = 'north-acessos-modelo.csv'

/** Canonical template body (also shipped under resources/templates/). */
export const CSV_TEMPLATE_CONTENT = [
  'tipo,cliente,ambiente,grupo,nome,protocolo,engine,host,porta,database,url,usuario,senha,notas,tags',
  'servidor,Acme,Produção,App,web-01,ssh,,10.0.0.10,22,,,ubuntu,,Notas do servidor,"ssh,prod"',
  'banco,Acme,Produção,App,postgres-app,,postgres,10.0.0.20,5432,appdb,,dbuser,,,"db,prod"',
  'login,Acme,Produção,App,painel-admin,,,,,,"https://admin.acme.example",admin,,URL do painel,web',
  ''
].join('\n')

export const REQUIRED_CSV_HEADERS = [
  'tipo',
  'cliente',
  'ambiente',
  'grupo',
  'nome',
  'protocolo',
  'engine',
  'host',
  'porta',
  'database',
  'url',
  'usuario',
  'senha',
  'notas',
  'tags'
] as const

export function defaultPortForProtocol(protocol: z.infer<typeof ConnectionProtocolSchema>): number {
  switch (protocol) {
    case 'ssh':
    case 'sftp':
      return 22
    case 'rdp':
      return 3389
    case 'vnc':
      return 5900
    case 'ftp':
      return 21
    case 'telnet':
      return 23
    case 'http':
      return 80
    case 'https':
      return 443
    default:
      return 22
  }
}

export function parseTagNames(tags: string | undefined): string[] {
  if (!tags) return []
  return tags
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Validate a raw CSV record into a typed inventory row.
 * Returns a Zod-safe result with a Portuguese message suitable for ImportReport.
 */
export function parseInventoryCsvRow(
  record: Record<string, string>
): { success: true; data: InventoryCsvRow } | { success: false; error: string } {
  const raw = normalizeCsvRecord(record)

  if (!raw.tipo || !CsvRowTipoSchema.safeParse(raw.tipo).success) {
    return { success: false, error: 'tipo inválido (use servidor, banco ou login)' }
  }
  if (!raw.cliente) return { success: false, error: 'cliente obrigatório' }
  if (!raw.ambiente) return { success: false, error: 'ambiente obrigatório' }
  if (!raw.grupo) return { success: false, error: 'grupo obrigatório' }
  if (!raw.nome) return { success: false, error: 'nome obrigatório' }
  if (raw.porta === 'invalid') return { success: false, error: 'porta inválida' }

  let typed: unknown

  switch (raw.tipo) {
    case 'servidor':
      typed = {
        tipo: 'servidor',
        cliente: raw.cliente,
        ambiente: raw.ambiente,
        grupo: raw.grupo,
        nome: raw.nome,
        protocolo: raw.protocolo,
        host: raw.host,
        porta: raw.porta ?? undefined,
        usuario: raw.usuario ?? undefined,
        senha: raw.senha ?? undefined,
        notas: raw.notas ?? undefined,
        tags: raw.tags ?? undefined
      }
      break
    case 'banco':
      typed = {
        tipo: 'banco',
        cliente: raw.cliente,
        ambiente: raw.ambiente,
        grupo: raw.grupo,
        nome: raw.nome,
        engine: raw.engine,
        host: raw.host,
        porta: raw.porta ?? undefined,
        database: raw.database ?? undefined,
        usuario: raw.usuario ?? undefined,
        senha: raw.senha ?? undefined,
        notas: raw.notas ?? undefined,
        tags: raw.tags ?? undefined
      }
      break
    case 'login':
      typed = {
        tipo: 'login',
        cliente: raw.cliente,
        ambiente: raw.ambiente,
        grupo: raw.grupo,
        nome: raw.nome,
        url: raw.url,
        usuario: raw.usuario,
        senha: raw.senha ?? undefined,
        notas: raw.notas ?? undefined,
        tags: raw.tags ?? undefined
      }
      break
  }

  const result = InventoryCsvRowSchema.safeParse(typed)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue?.path.join('.') || 'campo'
    const messages: Record<string, string> = {
      protocolo: 'protocolo inválido ou ausente',
      engine: 'engine inválida ou ausente',
      host: 'host obrigatório',
      url: 'url obrigatória',
      usuario: 'usuario obrigatório',
      porta: 'porta inválida',
      tipo: 'tipo inválido'
    }
    return {
      success: false,
      error: messages[path] ?? `${path}: ${issue?.message ?? 'inválido'}`
    }
  }

  return { success: true, data: result.data }
}
