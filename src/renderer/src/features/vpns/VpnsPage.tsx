import { EmptyState } from '@renderer/components/EmptyState'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useClients } from '@renderer/hooks/use-clients'
import {
  useImportOvpn,
  useVpnHelperAction,
  useVpnHelperStatus,
  useVpnProfiles,
  useVpnStates
} from '@renderer/hooks/use-vpn'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { vpnErrorFromUnknown } from '@renderer/lib/vpn-ui'
import { useVpnDialogsStore } from '@renderer/stores/vpn-dialogs-store'
import type { VpnProfile } from '@shared/types'
import { Plus, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { VpnDetails } from './VpnDetails'
import { toneOf, VpnDot } from './VpnStatus'
import { readOvpnFile } from './VpnWizardDialog'

export function VpnsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: profiles = [], isLoading } = useVpnProfiles()
  const { data: states = [] } = useVpnStates()
  const { data: clients = [] } = useClients()
  const [params, setParams] = useSearchParams()
  const openWizard = useVpnDialogsStore((s) => s.openWizard)
  const openSecrets = useVpnDialogsStore((s) => s.openSecrets)
  const importOvpn = useImportOvpn()
  const [dragging, setDragging] = useState(false)

  const selectedId = params.get('vpn')
  const selected = profiles.find((p) => p.id === selectedId) ?? null
  const select = (id: string): void => {
    const next = new URLSearchParams(params)
    next.set('vpn', id)
    setParams(next, { replace: true })
  }

  const groups = useMemo(() => {
    const clientName = new Map(clients.map((c) => [c.id, c.name]))
    const byClient = new Map<string, VpnProfile[]>()
    for (const p of profiles) {
      const key = p.clientId ?? ''
      byClient.set(key, [...(byClient.get(key) ?? []), p])
    }
    return [...byClient.entries()]
      .map(([key, items]) => ({ key, label: clientName.get(key) ?? t('vpn.noClient'), items }))
      .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.label.localeCompare(b.label)))
  }, [profiles, clients, t])

  const onDrop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault()
    setDragging(false)
    const file = [...event.dataTransfer.files].find((f) => /\.(ovpn|conf)$/i.test(f.name))
    if (!file) return
    try {
      const { profile } = await importOvpn.mutateAsync(await readOvpnFile(file))
      toastSuccess(t('vpn.toast.imported'))
      select(profile.id)
      openSecrets(profile.id)
    } catch (error) {
      const parsed = vpnErrorFromUnknown(error)
      toastError(parsed ? new Error(parsed.message) : error, t('vpn.toast.importFailed'))
    }
  }

  return (
    <section
      className="relative flex h-full min-h-0 flex-col"
      aria-label={t('vpn.title')}
      data-testid="vpns-page"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-medium text-foreground">{t('vpn.title')}</h1>
          <p className="mt-0.5 text-xs text-muted">{t('vpn.subtitle')}</p>
        </div>
        <Button size="sm" onClick={openWizard} data-testid="vpn-new">
          <Plus className="size-3.5" aria-hidden />
          {t('vpn.new')}
        </Button>
      </header>

      {!isLoading && profiles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('vpn.empty.title')}
          description={t('vpn.empty.description')}
          actionLabel={t('vpn.new')}
          onAction={openWizard}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ScrollArea className="w-72 shrink-0 border-r border-border">
            <nav className="space-y-4 p-2" aria-label={t('vpn.title')}>
              {groups.map((group) => (
                <div key={group.key}>
                  <h2 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
                    {group.label}
                  </h2>
                  <ul>
                    {group.items.map((p) => {
                      const state = states.find((s) => s.profileId === p.id)
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => select(p.id)}
                            data-testid="vpn-list-item"
                            aria-current={p.id === selectedId ? 'true' : undefined}
                            className={cn(
                              'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                              p.id === selectedId
                                ? 'bg-surface-elevated/80 text-foreground'
                                : 'text-muted hover:bg-surface-elevated/40 hover:text-foreground'
                            )}
                          >
                            <VpnDot tone={toneOf(state?.status)} />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="text-[11px] text-muted">
                              {t(`vpn.kind.${p.kind}`)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <VpnHelperCard />
          </ScrollArea>
          <div className="min-w-0 flex-1">
            {selected ? (
              <VpnDetails key={selected.id} profile={selected} />
            ) : (
              <EmptyState icon={ShieldCheck} title={t('vpn.select')} />
            )}
          </div>
        </div>
      )}

      {dragging ? (
        <div
          className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-background/80 text-sm text-foreground"
          data-testid="vpn-drop-overlay"
        >
          {t('vpn.empty.drop')}
        </div>
      ) : null}
    </section>
  )
}

/** Passwordless connect: install/remove the root helper (macOS/Linux; hidden elsewhere). */
function VpnHelperCard(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { data: status } = useVpnHelperStatus()
  const action = useVpnHelperAction()
  if (!status || status === 'unsupported') return null
  const installed = status === 'installed'
  return (
    <div className="m-2 space-y-2 border-t border-border px-2 pt-3" data-testid="vpn-helper">
      <p className="text-xs text-muted">
        {installed ? t('vpn.helper.installed') : t(`vpn.helper.${status}`)}
      </p>
      <Button
        size="sm"
        variant={installed ? 'ghost' : 'outline'}
        disabled={action.isPending}
        onClick={() => action.mutate(installed ? 'uninstall' : 'install')}
        data-testid="vpn-helper-action"
      >
        {installed ? t('vpn.helper.remove') : t('vpn.helper.install')}
      </Button>
    </div>
  )
}
