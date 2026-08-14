import { cn } from '@renderer/lib/utils'

type DetailSectionProps = {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export function DetailSection({
  title,
  children,
  className,
  action
}: DetailSectionProps): React.JSX.Element {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted">{title}</h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

type DetailFieldProps = {
  label: string
  value: React.ReactNode
  mono?: boolean
}

export function DetailField({ label, value, mono = false }: DetailFieldProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 min-w-0 break-words text-[13px] text-foreground',
          mono && 'font-mono text-[12px] break-all'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
