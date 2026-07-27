import type { LucideIcon } from 'lucide-react'
import {
  Cable,
  Cloud,
  Database,
  FolderOpen,
  Globe,
  HardDrive,
  KeyRound,
  Monitor,
  Network,
  ScreenShare,
  Server,
  Shield,
  Terminal,
  Wifi
} from 'lucide-react'

export type IconOption = {
  id: string
  label: string
  Icon: LucideIcon
}

export const ENTITY_ICONS: IconOption[] = [
  { id: 'server', label: 'Server', Icon: Server },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'monitor', label: 'Monitor', Icon: Monitor },
  { id: 'database', label: 'Database', Icon: Database },
  { id: 'globe', label: 'Globe', Icon: Globe },
  { id: 'folder', label: 'Folder', Icon: FolderOpen },
  { id: 'cloud', label: 'Cloud', Icon: Cloud },
  { id: 'shield', label: 'Shield', Icon: Shield },
  { id: 'key', label: 'Key', Icon: KeyRound },
  { id: 'network', label: 'Network', Icon: Network },
  { id: 'wifi', label: 'Wifi', Icon: Wifi },
  { id: 'hard-drive', label: 'Disk', Icon: HardDrive },
  { id: 'screen-share', label: 'Screen', Icon: ScreenShare },
  { id: 'cable', label: 'Cable', Icon: Cable }
]

export function resolveEntityIcon(id: string | null | undefined): LucideIcon {
  return ENTITY_ICONS.find((item) => item.id === id)?.Icon ?? Server
}
