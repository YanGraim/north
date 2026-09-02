import { NameDialog } from '@renderer/components/NameDialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { CollectionTransferDialog } from '@renderer/features/api/CollectionTransferDialog'
import { ApisTree } from '@renderer/features/navigation/ApisTree'
import { ClientTree } from '@renderer/features/navigation/ClientTree'
import { NavItem } from '@renderer/features/navigation/NavItem'
import { ProfileChip } from '@renderer/features/navigation/ProfileChip'
import { SidebarSection } from '@renderer/features/navigation/SidebarSection'
import { TagList } from '@renderer/features/navigation/TagList'
import { useCreateApiCollection } from '@renderer/hooks/use-api'
import { cn } from '@renderer/lib/utils'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { openApiStudioTab } from '@renderer/stores/sessions-store'
import { useUiStore } from '@renderer/stores/ui-store'
import { Clock3, FolderInput, History, LayoutDashboard, Server, Settings, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function Sidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const overviewExpanded = useUiStore((s) => s.sidebarOverviewExpanded)
  const clientsExpanded = useUiStore((s) => s.sidebarClientsExpanded)
  const apisExpanded = useUiStore((s) => s.sidebarApisExpanded)
  const tagsExpanded = useUiStore((s) => s.sidebarTagsExpanded)
  const setSidebarOverviewExpanded = useUiStore((s) => s.setSidebarOverviewExpanded)
  const setSidebarClientsExpanded = useUiStore((s) => s.setSidebarClientsExpanded)
  const setSidebarApisExpanded = useUiStore((s) => s.setSidebarApisExpanded)
  const setSidebarTagsExpanded = useUiStore((s) => s.setSidebarTagsExpanded)
  const openDialog = useInventoryDialogsStore((s) => s.open)
  const createCollection = useCreateApiCollection()
  const [nameKind, setNameKind] = useState<'create' | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border bg-surface">
      <ScrollArea className="min-h-0 flex-1">
        <div
          className={cn(
            'flex flex-col gap-3',
            collapsed ? 'items-center px-1 py-2' : 'items-stretch p-2'
          )}
        >
          <SidebarSection
            title={t('nav.overview')}
            collapsed={collapsed}
            expandable
            expanded={overviewExpanded}
            onExpandedChange={setSidebarOverviewExpanded}
          >
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
            expandable
            expanded={clientsExpanded}
            onExpandedChange={setSidebarClientsExpanded}
          >
            <ClientTree collapsed={collapsed} />
          </SidebarSection>

          <div
            className={cn('h-px shrink-0 bg-border/60', collapsed ? 'w-6' : 'w-full')}
            aria-hidden
          />

          <SidebarSection
            title={t('nav.apis')}
            collapsed={collapsed}
            addLabel={t('api.studio.newCollection')}
            onAdd={() => setNameKind('create')}
            extraAction={{
              label: t('api.transfer.importExport'),
              icon: FolderInput,
              onClick: () => setTransferOpen(true)
            }}
            expandable
            expanded={apisExpanded}
            onExpandedChange={setSidebarApisExpanded}
          >
            <ApisTree
              collapsed={collapsed}
              onCreate={() => setNameKind('create')}
              onImport={() => setTransferOpen(true)}
            />
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
            expandable
            expanded={tagsExpanded}
            onExpandedChange={setSidebarTagsExpanded}
          >
            <TagList collapsed={collapsed} />
          </SidebarSection>
        </div>
      </ScrollArea>

      <div
        className={cn(
          'shrink-0 border-t border-border',
          collapsed ? 'flex flex-col items-center gap-2 py-2' : 'flex flex-col gap-1 p-2'
        )}
      >
        <NavItem
          to="/settings"
          label={t('nav.settings')}
          icon={Settings}
          collapsed={collapsed}
          plain={collapsed}
        />
        <ProfileChip collapsed={collapsed} />
      </div>

      <NameDialog
        open={nameKind !== null}
        onOpenChange={(open) => {
          if (!open) setNameKind(null)
        }}
        title={t('api.studio.newCollection')}
        showScope
        confirmLabel={t('common.create')}
        onSubmit={(input) => {
          createCollection.mutate(
            { clientId: input.clientId, name: input.name },
            {
              onSuccess: (collection) => {
                openApiStudioTab({
                  collectionId: collection.id,
                  collectionName: collection.name,
                  clientId: collection.clientId,
                  title: collection.name
                })
              }
            }
          )
        }}
      />
      <CollectionTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </aside>
  )
}
