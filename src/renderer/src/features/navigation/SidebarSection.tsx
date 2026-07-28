import { cn } from '@renderer/lib/utils'
import { ChevronDown, Plus } from 'lucide-react'

/**
 * Linha padrão do sidebar aberto: conteúdo | coluna fixa de 16px (mesmo eixo do + e das contagens).
 */
export const SIDEBAR_ROW = 'grid w-full grid-cols-[minmax(0,1fr)_1rem] items-center px-2'

/** Célula da coluna direita — + e números centralizados na mesma caixa. */
export const SIDEBAR_TRAILING =
  'flex size-4 items-center justify-center font-mono text-[11px] leading-none tabular-nums text-muted'

type SidebarSectionProps = {
  title: string
  collapsed?: boolean
  children: React.ReactNode
  className?: string
  onAdd?: () => void
  addLabel?: string
  /** When set, the section title toggles content visibility. */
  expandable?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function SidebarSection({
  title,
  collapsed = false,
  children,
  className,
  onAdd,
  addLabel = 'Adicionar',
  expandable = false,
  expanded = true,
  onExpandedChange
}: SidebarSectionProps): React.JSX.Element {
  const showChildren = collapsed || !expandable || expanded

  return (
    <section
      className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-0.5', className)}
    >
      {!collapsed ? (
        <div className={cn(SIDEBAR_ROW, 'h-6')}>
          {expandable ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 text-left text-muted transition-colors hover:text-foreground"
              aria-expanded={expanded}
              onClick={() => onExpandedChange?.(!expanded)}
            >
              <ChevronDown
                className={cn(
                  'size-3 shrink-0 transition-transform motion-safe:duration-150',
                  expanded ? 'rotate-0' : '-rotate-90'
                )}
                aria-hidden
              />
              <span className="truncate text-[11px] font-medium uppercase tracking-wider">
                {title}
              </span>
            </button>
          ) : (
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
              {title}
            </p>
          )}
          {onAdd ? (
            <button
              type="button"
              className={cn(SIDEBAR_TRAILING, 'hover:text-foreground')}
              aria-label={addLabel}
              onClick={onAdd}
            >
              <Plus className="size-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span aria-hidden />
          )}
        </div>
      ) : null}
      {showChildren ? (
        <div className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-0.5')}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
