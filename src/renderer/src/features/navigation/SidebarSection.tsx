import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import { ChevronDown, type LucideIcon, Plus } from 'lucide-react'

/**
 * Linha padrão do sidebar aberto: conteúdo | coluna fixa de 16px (mesmo eixo do + e das contagens).
 */
export const SIDEBAR_ROW = 'grid w-full grid-cols-[minmax(0,1fr)_1rem] items-center px-2'

/** Célula da coluna direita — + e números centralizados na mesma caixa. */
export const SIDEBAR_TRAILING =
  'flex size-4 items-center justify-center font-mono text-[11px] leading-none tabular-nums text-muted'

const HEADER_ICON_BUTTON =
  'inline-flex size-6 items-center justify-center rounded-sm text-muted hover:bg-surface-elevated/60 hover:text-foreground'

function HeaderIconButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={HEADER_ICON_BUTTON} aria-label={label} onClick={onClick}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

type SidebarSectionProps = {
  title: string
  collapsed?: boolean
  children: React.ReactNode
  className?: string
  onAdd?: () => void
  addLabel?: string
  addMenu?: Array<{ label: string; onSelect: () => void }>
  extraAction?: { label: string; icon: LucideIcon; onClick: () => void }
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
  addMenu,
  extraAction,
  expandable = false,
  expanded = true,
  onExpandedChange
}: SidebarSectionProps): React.JSX.Element {
  const showChildren = collapsed || !expandable || expanded
  const ExtraIcon = extraAction?.icon
  const hasAdd = Boolean(onAdd || (addMenu && addMenu.length > 0))

  return (
    <section
      className={cn('flex flex-col', collapsed ? 'items-center gap-1.5' : 'gap-0.5', className)}
    >
      {!collapsed ? (
        <div className="flex h-6 w-full items-center gap-1 px-2">
          {expandable ? (
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1 text-left text-muted transition-colors hover:text-foreground"
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
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
              {title}
            </p>
          )}
          {extraAction || hasAdd ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {extraAction && ExtraIcon ? (
                <HeaderIconButton
                  label={extraAction.label}
                  onClick={(event) => {
                    event.stopPropagation()
                    extraAction.onClick()
                  }}
                >
                  <ExtraIcon className="size-3.5" strokeWidth={2} />
                </HeaderIconButton>
              ) : null}
              {addMenu && addMenu.length > 0 ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={HEADER_ICON_BUTTON}
                          aria-label={addLabel}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Plus className="size-3.5" strokeWidth={2} />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{addLabel}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    {addMenu.map((item) => (
                      <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : onAdd ? (
                <HeaderIconButton label={addLabel} onClick={onAdd}>
                  <Plus className="size-3.5" strokeWidth={2} />
                </HeaderIconButton>
              ) : null}
            </div>
          ) : null}
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
