import {
  environmentBadgeLabel,
  environmentContextMessage,
  environmentKind,
  environmentStatusColor,
  hasEnvironmentContext
} from '@renderer/lib/environment-color'
import { AlertTriangle, Code2, FlaskConical } from 'lucide-react'

type EnvironmentContextBannerProps = {
  environmentName: string | null | undefined
  color?: string | null
}

export function EnvironmentContextBanner({
  environmentName,
  color
}: EnvironmentContextBannerProps): React.JSX.Element | null {
  if (!environmentName || !hasEnvironmentContext(environmentName)) {
    return null
  }

  const kind = environmentKind(environmentName)
  const accent = environmentStatusColor(environmentName, color)
  const label = environmentBadgeLabel(environmentName)
  const message = environmentContextMessage(environmentName)
  const Icon = kind === 'production' ? AlertTriangle : kind === 'staging' ? FlaskConical : Code2

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b px-4 py-1.5"
      style={{
        borderColor: `${accent}4d`,
        backgroundColor: `${accent}1a`
      }}
      role="status"
      aria-live="polite"
    >
      <Icon className="size-3.5 shrink-0" style={{ color: accent }} aria-hidden />
      <p className="text-[11px] leading-snug" style={{ color: `${accent}cc` }}>
        <span className="font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {label}
        </span>
        {' · '}
        {message}
      </p>
    </div>
  )
}

/** @deprecated Use EnvironmentContextBanner */
export const ProductionContextBanner = EnvironmentContextBanner
