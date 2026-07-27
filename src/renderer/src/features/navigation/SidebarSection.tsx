import { cn } from '@renderer/lib/utils'
import { Plus } from 'lucide-react'

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
}

export function SidebarSection({
  title,
  collapsed = false,
  children,
  className,
  onAdd,
  addLabel = 'Adicionar'
}: SidebarSectionProps): React.JSX.Element {
  return (
    <section
      className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-0.5', className)}
    >
      {!collapsed ? (
        onAdd ? (
          <div className={cn(SIDEBAR_ROW, 'h-6')}>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
              {title}
            </p>
            <button
              type="button"
              className={cn(SIDEBAR_TRAILING, 'hover:text-foreground')}
              aria-label={addLabel}
              onClick={onAdd}
            >
              <Plus className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex h-6 items-center px-2">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">
              {title}
            </p>
          </div>
        )
      ) : null}
      <div className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-0.5')}>
        {children}
      </div>
    </section>
  )
}
