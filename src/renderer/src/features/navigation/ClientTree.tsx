import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@renderer/components/ui/collapsible'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { countItemsByGroup } from '@renderer/features/navigation/count-items-by-group'
import { SIDEBAR_ROW, SIDEBAR_TRAILING } from '@renderer/features/navigation/SidebarSection'
import { TreeNodeContextMenu } from '@renderer/features/navigation/TreeNodeContextMenu'
import { useAccesses } from '@renderer/hooks/use-accesses'
import { useConnections } from '@renderer/hooks/use-connections'
import { useOrgLookup } from '@renderer/hooks/use-org-lookup'
import { environmentStatusColor } from '@renderer/lib/environment-color'
import { cn } from '@renderer/lib/utils'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useUiStore } from '@renderer/stores/ui-store'
import { Building2, ChevronRight, Folder } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, useParams, useSearchParams } from 'react-router-dom'

const ROW_ACTIVE = 'bg-surface-elevated/80 text-foreground'
const ROW_IDLE = 'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
const LINK =
  'flex h-8 min-w-0 w-full items-center gap-1.5 rounded-md text-[13px] transition-colors motion-safe:duration-150'
const CHEVRON_BTN =
  'inline-flex size-4 shrink-0 items-center justify-center text-muted hover:text-foreground'

/** Indentação só no bloco esquerdo — contagem fica na coluna do +. */
const DEPTH_PL = ['pl-0', 'pl-3', 'pl-6'] as const

function treeKey(kind: 'client' | 'env', id: string): string {
  return `${kind}:${id}`
}

function Count({ value }: { value: number }): React.JSX.Element {
  return <span className={SIDEBAR_TRAILING}>{value}</span>
}

export function ClientTree({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  const { clientId: routeClientId } = useParams()
  const [searchParams] = useSearchParams()
  const activeEnv = searchParams.get('env')
  const activeGroup = searchParams.get('group')
  const openDialog = useInventoryDialogsStore((s) => s.open)

  const { clients, environments, groups, isLoading } = useOrgLookup()
  const { data: connections = [] } = useConnections()
  const { data: accesses = [] } = useAccesses()
  const expandedTreeNodes = useUiStore((s) => s.expandedTreeNodes)
  const setTreeNodeExpanded = useUiStore((s) => s.setTreeNodeExpanded)
  const isExpanded = (id: string): boolean => Boolean(expandedTreeNodes[id])

  useEffect(() => {
    if (routeClientId) setTreeNodeExpanded(treeKey('client', routeClientId), true)
  }, [routeClientId, setTreeNodeExpanded])

  useEffect(() => {
    if (activeEnv) setTreeNodeExpanded(treeKey('env', activeEnv), true)
  }, [activeEnv, setTreeNodeExpanded])

  const countsByGroup = countItemsByGroup(connections, accesses)

  const countForEnv = (environmentId: string): number =>
    groups
      .filter((g) => g.environmentId === environmentId)
      .reduce((sum, g) => sum + (countsByGroup.get(g.id) ?? 0), 0)

  const countForClient = (clientId: string): number =>
    environments
      .filter((e) => e.clientId === clientId)
      .reduce((sum, e) => sum + countForEnv(e.id), 0)

  if (collapsed) {
    return (
      <div className="flex w-full flex-col items-center gap-1.5">
        {clients.map((client) => (
          <TreeNodeContextMenu key={client.id} kind="client" client={client}>
            <div className="flex size-8 shrink-0 items-center justify-center">
              <NavLink
                to={`/clients/${client.id}`}
                aria-label={client.name}
                title={client.name}
                className={({ isActive }) =>
                  cn(
                    'flex size-8 items-center justify-center rounded-md transition-colors motion-safe:duration-150',
                    isActive ? ROW_ACTIVE : ROW_IDLE
                  )
                }
              >
                <Building2
                  className="size-3.5"
                  style={client.color ? { color: client.color } : undefined}
                />
              </NavLink>
            </div>
          </TreeNodeContextMenu>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 px-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-8 w-4/6" />
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="space-y-2 px-2 py-1">
        <p className="text-xs text-muted">Nenhum cliente ainda.</p>
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={() => openDialog({ type: 'client', mode: 'create' })}
        >
          Criar cliente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {clients.map((client) => {
        const clientKey = treeKey('client', client.id)
        const clientOpen = isExpanded(clientKey)
        const clientEnvs = environments
          .filter((e) => e.clientId === client.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const clientActive = Boolean(routeClientId === client.id && !activeEnv && !activeGroup)

        return (
          <Collapsible
            key={client.id}
            open={clientOpen}
            onOpenChange={(open) => setTreeNodeExpanded(clientKey, open)}
          >
            <div className={cn(SIDEBAR_ROW, 'h-8')}>
              <div className={cn('flex min-w-0 items-center gap-0.5', DEPTH_PL[0])}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={CHEVRON_BTN}
                    aria-label={clientOpen ? 'Recolher cliente' : 'Expandir cliente'}
                  >
                    <ChevronRight
                      className={cn(
                        'size-3.5 transition-transform motion-safe:duration-150',
                        clientOpen && 'rotate-90'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <TreeNodeContextMenu kind="client" client={client}>
                  <div className="min-w-0 flex-1">
                    <NavLink
                      to={`/clients/${client.id}`}
                      onClick={() => setTreeNodeExpanded(clientKey, true)}
                      className={cn(LINK, clientActive ? ROW_ACTIVE : ROW_IDLE)}
                    >
                      <Building2
                        className="size-3.5 shrink-0"
                        style={client.color ? { color: client.color } : undefined}
                      />
                      <span className="min-w-0 flex-1 truncate">{client.name}</span>
                    </NavLink>
                  </div>
                </TreeNodeContextMenu>
              </div>
              <Count value={countForClient(client.id)} />
            </div>

            <CollapsibleContent className="flex flex-col gap-0.5">
              {clientEnvs.map((env) => {
                const envKey = treeKey('env', env.id)
                const envGroups = groups
                  .filter((g) => g.environmentId === env.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const envOpen = isExpanded(envKey)
                const envColor = environmentStatusColor(env.name, env.color)
                const envActive = Boolean(
                  routeClientId === client.id && activeEnv === env.id && !activeGroup
                )

                return (
                  <Collapsible
                    key={env.id}
                    open={envOpen}
                    onOpenChange={(open) => setTreeNodeExpanded(envKey, open)}
                  >
                    <div className={cn(SIDEBAR_ROW, 'h-8')}>
                      <div className={cn('flex min-w-0 items-center gap-0.5', DEPTH_PL[1])}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className={CHEVRON_BTN}
                            aria-label={envOpen ? 'Recolher ambiente' : 'Expandir ambiente'}
                          >
                            <ChevronRight
                              className={cn(
                                'size-3.5 transition-transform motion-safe:duration-150',
                                envOpen && 'rotate-90'
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <TreeNodeContextMenu
                          kind="environment"
                          environment={env}
                          clientId={client.id}
                        >
                          <div className="min-w-0 flex-1">
                            <NavLink
                              to={`/clients/${client.id}?env=${env.id}`}
                              onClick={() => setTreeNodeExpanded(envKey, true)}
                              className={cn(LINK, envActive ? ROW_ACTIVE : ROW_IDLE)}
                            >
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: envColor }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate">{env.name}</span>
                            </NavLink>
                          </div>
                        </TreeNodeContextMenu>
                      </div>
                      <Count value={countForEnv(env.id)} />
                    </div>

                    <CollapsibleContent className="flex flex-col gap-0.5">
                      {envGroups.map((group) => (
                        <div key={group.id} className={cn(SIDEBAR_ROW, 'h-8')}>
                          <div className={cn('flex min-w-0 items-center gap-0.5', DEPTH_PL[2])}>
                            <span className="size-4 shrink-0" aria-hidden />
                            <TreeNodeContextMenu
                              kind="group"
                              group={group}
                              clientId={client.id}
                              environmentId={env.id}
                            >
                              <div className="min-w-0 flex-1">
                                <NavLink
                                  to={`/clients/${client.id}?env=${env.id}&group=${group.id}`}
                                  className={cn(
                                    LINK,
                                    activeGroup === group.id ? ROW_ACTIVE : ROW_IDLE
                                  )}
                                >
                                  <Folder className="size-3.5 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                                </NavLink>
                              </div>
                            </TreeNodeContextMenu>
                          </div>
                          <Count value={countsByGroup.get(group.id) ?? 0} />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
