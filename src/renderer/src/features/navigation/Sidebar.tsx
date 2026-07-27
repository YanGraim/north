import { ClientTree } from '@renderer/features/navigation/ClientTree'
import { NavItem } from '@renderer/features/navigation/NavItem'
import { SidebarSection } from '@renderer/features/navigation/SidebarSection'
import { TagList } from '@renderer/features/navigation/TagList'
import { cn } from '@renderer/lib/utils'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useUiStore } from '@renderer/stores/ui-store'
import { Clock3, History, LayoutDashboard, Server, Settings, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Sidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const openDialog = useInventoryDialogsStore((s) => s.open)

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] motion-safe:duration-200',
        collapsed ? 'w-12' : 'w-56'
      )}
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden',
          collapsed
            ? 'items-center overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'items-stretch overflow-y-auto p-2'
        )}
      >
        <SidebarSection title={t('nav.overview')} collapsed={collapsed}>
          <NavItem
            to="/dashboard"
            label={t('nav.dashboard')}
            icon={LayoutDashboard}
            collapsed={collapsed}
            plain={collapsed}
          />
          <NavItem
            to="/connections"
            label={t('nav.connections')}
            icon={Server}
            collapsed={collapsed}
            plain={collapsed}
            end
          />
          <NavItem
            to="/favorites"
            label={t('nav.favorites')}
            icon={Star}
            collapsed={collapsed}
            plain={collapsed}
          />
          <NavItem
            to="/recents"
            label={t('nav.recents')}
            icon={Clock3}
            collapsed={collapsed}
            plain={collapsed}
          />
          <NavItem
            to="/history"
            label={t('nav.history')}
            icon={History}
            collapsed={collapsed}
            plain={collapsed}
          />
        </SidebarSection>

        <div
          className={cn('h-px shrink-0 bg-border/60', collapsed ? 'w-6' : 'w-full')}
          aria-hidden
        />

        <SidebarSection
          title={t('nav.clients')}
          collapsed={collapsed}
          addLabel={t('nav.newClient')}
          onAdd={() => openDialog({ type: 'client', mode: 'create' })}
        >
          <ClientTree collapsed={collapsed} />
        </SidebarSection>

        <div
          className={cn('h-px shrink-0 bg-border/60', collapsed ? 'w-6' : 'w-full')}
          aria-hidden
        />

        <SidebarSection
          title={t('nav.tags')}
          collapsed={collapsed}
          addLabel={t('nav.newTag')}
          onAdd={() => openDialog({ type: 'tag', mode: 'create' })}
        >
          <TagList collapsed={collapsed} />
        </SidebarSection>
      </div>

      <div
        className={cn(
          'shrink-0 border-t border-border',
          collapsed ? 'flex items-center justify-center py-2' : 'p-2'
        )}
      >
        <NavItem
          to="/settings"
          label={t('nav.settings')}
          icon={Settings}
          collapsed={collapsed}
          plain={collapsed}
        />
      </div>
    </aside>
  )
}
