import { resolveEntityIcon } from '@renderer/lib/entity-icons'
import type { Connection, ConnectionProtocol } from '@shared/types'
import {
  Cable,
  FolderOpen,
  Globe,
  type LucideIcon,
  Monitor,
  ScreenShare,
  Terminal,
  Usb
} from 'lucide-react'

const PROTOCOL_ICONS: Record<ConnectionProtocol, LucideIcon> = {
  ssh: Terminal,
  rdp: Monitor,
  vnc: ScreenShare,
  sftp: FolderOpen,
  ftp: FolderOpen,
  telnet: Terminal,
  serial: Usb,
  http: Globe,
  https: Globe,
  custom: Cable
}

export function protocolIcon(protocol: ConnectionProtocol): LucideIcon {
  return PROTOCOL_ICONS[protocol] ?? Cable
}

export function connectionDisplayIcon(
  connection: Pick<Connection, 'protocol' | 'icon'>
): LucideIcon {
  if (connection.icon) {
    return resolveEntityIcon(connection.icon)
  }
  return protocolIcon(connection.protocol)
}

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const now = Date.now()
  const diffMs = now - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'agora'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} h`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} d`

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatLastAccess(iso: string | null): string {
  if (!iso) return 'Nunca acessado'
  const relative = formatRelativeDate(iso)
  if (relative === 'agora') return 'Agora'
  if (relative === '—') return 'Nunca acessado'
  return `Acessado ${relative}`
}

export function formatDayHeading(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(date, today)) return 'Hoje'
  if (sameDay(date, yesterday)) return 'Ontem'

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

export function authMethodLabel(method: string): string {
  switch (method) {
    case 'password':
      return 'Senha'
    case 'key':
      return 'Chave'
    case 'agent':
      return 'Agent'
    case 'none':
      return 'Nenhuma'
    default:
      return method
  }
}
