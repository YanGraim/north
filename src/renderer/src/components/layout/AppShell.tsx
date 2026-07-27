import { useAppVersion } from '@renderer/hooks/use-app-version'
import { cn } from '@renderer/lib/utils'
import { useUiStore } from '@renderer/stores/ui-store'
import { PanelLeft } from 'lucide-react'

export function AppShell(): React.JSX.Element {
  const { data: version, isLoading } = useAppVersion()
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="titlebar flex h-11 shrink-0 items-center border-b border-border bg-surface px-4">
        <div className="flex w-full items-center justify-between pl-16">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted transition hover:bg-surface-elevated hover:text-foreground"
              aria-label="Alternar barra lateral"
            >
              <PanelLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-semibold tracking-wide text-foreground">
              North
            </span>
          </div>
          <span className="font-mono text-xs text-muted">
            {isLoading ? '…' : `v${version ?? '—'}`}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'shrink-0 border-r border-border bg-surface transition-[width] duration-200',
            sidebarCollapsed ? 'w-14' : 'w-56'
          )}
        >
          <div className="p-3">
            <p
              className={cn(
                'text-xs font-medium uppercase tracking-wider text-muted',
                sidebarCollapsed && 'sr-only'
              )}
            >
              Navegação
            </p>
            <div className="mt-3 space-y-1">
              <div className="rounded-md bg-surface-elevated px-3 py-2 text-sm text-foreground">
                {sidebarCollapsed ? '•' : 'Workspace'}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col border-r border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h1 className="text-sm font-medium text-foreground">Conexões</h1>
            <p className="mt-0.5 text-xs text-muted">Lista de servidores e ambientes</p>
          </div>
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-muted">Painel de lista — em breve</p>
          </div>
        </section>

        <section className="flex w-[360px] shrink-0 flex-col bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Detalhes</h2>
            <p className="mt-0.5 text-xs text-muted">Informações da conexão selecionada</p>
          </div>
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-muted">Painel de detalhes — em breve</p>
          </div>
        </section>
      </div>
    </div>
  )
}
