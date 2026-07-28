import { environmentStatusColor, hasEnvironmentContext } from '@renderer/lib/environment-color'
import { cn } from '@renderer/lib/utils'
import {
  type SessionTab,
  useSessionsStore,
  WORKSPACE_TAB_ID
} from '@renderer/stores/sessions-store'
import type { SessionState } from '@shared/protocols'
import { LayoutGrid, X } from 'lucide-react'
import { useRef, useState } from 'react'

function stateDotStyle(
  state: SessionState | undefined,
  accent: string | null
): React.CSSProperties | undefined {
  if (!accent) return undefined
  if (state === 'connected' || state === 'connecting' || state === 'reconnecting') {
    return { backgroundColor: accent }
  }
  return undefined
}

function stateDotClass(state: SessionState | undefined, accented: boolean): string {
  switch (state) {
    case 'connected':
      return accented ? '' : 'bg-emerald-500'
    case 'connecting':
    case 'reconnecting':
      return accented ? 'animate-pulse' : 'bg-amber-400 animate-pulse'
    case 'error':
      return 'bg-red-500'
    case 'closed':
      return 'bg-muted'
    default:
      return 'bg-muted'
  }
}

function TabButton({
  tab,
  index,
  active,
  onActivate,
  onClose,
  onDragStart,
  onDrop
}: {
  tab: SessionTab
  index: number
  active: boolean
  onActivate: () => void
  onClose?: () => void
  onDragStart: (index: number) => void
  onDrop: (index: number) => void
}): React.JSX.Element {
  const isWorkspace = tab.kind === 'workspace'
  const hasContext = Boolean(tab.environmentName && hasEnvironmentContext(tab.environmentName))
  const accent = hasContext
    ? environmentStatusColor(tab.environmentName ?? '', tab.environmentColor)
    : null

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={active}
      draggable={!isWorkspace}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        if (!isWorkspace) e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(index)
      }}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={cn(
        'group flex h-8 max-w-[12rem] shrink-0 items-center gap-1.5 border-r border-border px-2.5 text-[12px] transition-colors motion-safe:duration-150',
        isWorkspace && 'min-w-[7.5rem] font-medium',
        active
          ? accent
            ? 'text-foreground ring-1 ring-inset'
            : 'bg-background text-foreground'
          : accent
            ? 'hover:text-foreground'
            : isWorkspace
              ? 'bg-surface-elevated/40 text-foreground/80 hover:bg-surface-elevated/70 hover:text-foreground'
              : 'bg-surface text-muted hover:bg-surface-elevated/50 hover:text-foreground'
      )}
      style={
        accent
          ? {
              borderColor: `${accent}40`,
              backgroundColor: active ? `${accent}26` : `${accent}14`,
              ...(active ? { boxShadow: `inset 0 0 0 1px ${accent}59` } : {}),
              color: active ? undefined : `${accent}cc`
            }
          : undefined
      }
    >
      {isWorkspace ? (
        <LayoutGrid className="size-3.5 shrink-0 text-accent" />
      ) : (
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            stateDotClass(tab.state, Boolean(accent))
          )}
          style={stateDotStyle(tab.state, accent)}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{isWorkspace ? 'Workspace' : tab.title}</span>
      {!isWorkspace && onClose ? (
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-elevated hover:text-foreground"
          aria-label={`Fechar ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  )
}

export function SessionTabs(): React.JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const reorderTabs = useSessionsStore((s) => s.reorderTabs)
  const dragFrom = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      role="tablist"
      aria-label="Abas de sessão"
      className={cn(
        'flex h-8 shrink-0 items-stretch overflow-x-auto overflow-y-hidden border-b border-border bg-surface',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        dragging && 'cursor-grabbing'
      )}
    >
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.id}
          tab={tab}
          index={index}
          active={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
          onClose={
            tab.id === WORKSPACE_TAB_ID
              ? undefined
              : () => {
                  void closeTab(tab.id)
                }
          }
          onDragStart={(from) => {
            dragFrom.current = from
            setDragging(true)
          }}
          onDrop={(to) => {
            const from = dragFrom.current
            dragFrom.current = null
            setDragging(false)
            if (from === null || from === to) return
            reorderTabs(from, to)
          }}
        />
      ))}
    </div>
  )
}
