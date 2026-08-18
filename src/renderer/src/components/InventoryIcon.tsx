import { BrandMark } from '@renderer/components/BrandMark'
import { accessTypeIcon } from '@renderer/lib/access-ui'
import { connectionDisplayIcon, protocolIcon } from '@renderer/lib/connection-ui'
import { resolveEngineBrand, usesCustomInventoryIcon } from '@renderer/lib/engine-brands'
import { resolveEntityIcon } from '@renderer/lib/entity-icons'
import { cn } from '@renderer/lib/utils'
import type { AccessType, ConnectionProtocol, DatabaseEngine } from '@shared/types'
import { Server } from 'lucide-react'

type InventoryIconProps = {
  className?: string
  icon?: string | null
  protocol?: ConnectionProtocol | null
  accessType?: AccessType | null
  engine?: DatabaseEngine | null
}

/** Custom Lucide → engine brand → protocol / access type (Lucide). */
export function InventoryIcon({
  className,
  icon,
  protocol,
  accessType,
  engine
}: InventoryIconProps): React.JSX.Element {
  const mergedClass = cn('shrink-0', className)

  if (usesCustomInventoryIcon(icon)) {
    const Custom = resolveEntityIcon(icon)
    return <Custom className={mergedClass} aria-hidden />
  }

  const brand = resolveEngineBrand(engine)
  if (brand) {
    return <BrandMark engine={brand} className={mergedClass} />
  }

  if (protocol) {
    const ProtocolIcon = connectionDisplayIcon({ protocol, icon: null })
    return <ProtocolIcon className={mergedClass} aria-hidden />
  }

  if (accessType) {
    const TypeIcon = accessTypeIcon(accessType)
    return <TypeIcon className={mergedClass} aria-hidden />
  }

  return <Server className={mergedClass} aria-hidden />
}

export { protocolIcon }
