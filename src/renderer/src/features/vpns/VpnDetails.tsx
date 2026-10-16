import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { useClients } from '@renderer/hooks/use-clients'
import {
  useDeleteVpn,
  useDisconnectVpn,
  useUpdateVpn,
  useVpnHistory,
  useVpnLogs,
  useVpnState
} from '@renderer/hooks/use-vpn'
import { copyToClipboard } from '@renderer/lib/clipboard'
import { formatRelativeDate } from '@renderer/lib/connection-ui'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import { vpnErrorAction } from '@renderer/lib/vpn-ui'
import { useVpnDialogsStore } from '@renderer/stores/vpn-dialogs-store'
import type { VpnProfile, VpnState } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVpnConnect } from './use-vpn-connect'
import { VpnConnectionEditor } from './VpnConnectionEditor'
import { VpnCredentialsForm } from './VpnCredentialsForm'
import { VpnStatusLabel } from './VpnStatus'

const TABS = ['overview', 'config', 'logs', 'history'] as const
type Tab = (typeof TABS)[number]
const NO_CLIENT = '__none'

export function VpnDetails({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('overview')
  const state = useVpnState(profile.id)

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="vpn-details">
      <div className="border-b border-border px-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium text-foreground">{profile.name}</h2>
            <p className="text-xs text-muted">{t(`vpn.kind.${profile.kind}`)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTab('config')} data-testid="vpn-edit">
              {t('vpn.edit.button')}
            </Button>
            <ConnectButton profile={profile} state={state} />
          </div>
        </div>
        <div role="tablist" className="mt-3 flex gap-1" aria-label={profile.name}>
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`vpn-tab-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-xs transition-colors',
                tab === id
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted hover:text-foreground'
              )}
            >
              {t(`vpn.tabs.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4" role="tabpanel">
          {tab === 'overview' ? <Overview profile={profile} state={state} /> : null}
          {tab === 'config' ? <Config profile={profile} /> : null}
          {tab === 'logs' ? <Logs profile={profile} /> : null}
          {tab === 'history' ? <History profile={profile} /> : null}
        </div>
      </ScrollArea>
    </div>
  )
}

function ConnectButton({
  profile,
  state
}: {
  profile: VpnProfile
  state?: VpnState
}): React.JSX.Element {
  const { t } = useTranslation()
  const { connect } = useVpnConnect()
  const disconnect = useDisconnectVpn()
  const status = state?.status ?? 'disconnected'
  const on = status === 'connected' || status === 'connecting' || status === 'reconnecting'
  return on ? (
    <Button
      variant="outline"
      onClick={() => disconnect.mutate(profile.id)}
      data-testid="vpn-disconnect"
      disabled={status === 'connecting' && disconnect.isPending}
    >
      {t('vpn.actions.disconnect')}
    </Button>
  ) : (
    <Button
      onClick={() => void connect(profile.id)}
      data-testid="vpn-connect"
      disabled={status === 'disconnecting'}
    >
      {t('vpn.actions.connect')}
    </Button>
  )
}

/** Inline error + the one action that fixes it — never a stack trace. */
export function VpnErrorNotice({
  profile,
  state
}: {
  profile: VpnProfile
  state?: VpnState
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const openSecrets = useVpnDialogsStore((s) => s.openSecrets)
  const { connect } = useVpnConnect()
  const [showInstall, setShowInstall] = useState(false)
  const queryClient = useQueryClient()
  const error = state?.lastError
  if (!error || state?.status !== 'error') return null
  const action = vpnErrorAction(error.code)
  return (
    <div
      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
      role="alert"
      data-testid="vpn-error"
    >
      <p className="text-foreground">{t(`vpn.errors.${error.code}`)}</p>
      {error.code === 'CONNECTION_REJECTED' || error.code === 'CERT_UNTRUSTED' ? (
        <p className="mt-1 text-xs text-muted">{error.message}</p>
      ) : null}
      {error.code === 'CERT_UNTRUSTED' && error.certDigest ? (
        <p
          className="mt-2 break-all font-mono text-[11px] text-foreground"
          data-testid="vpn-cert-digest"
        >
          SHA-256 {error.certDigest}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        {action === 'update-secret' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openSecrets(profile.id)}
            data-testid="vpn-error-update-secret"
          >
            {t('vpn.actions.updateSecret')}
          </Button>
        ) : null}
        {action === 'trust-cert' &&
        error.certDigest &&
        profile.config.kind === 'fortinet-sslvpn' ? (
          <Button
            size="sm"
            variant="outline"
            data-testid="vpn-trust-cert"
            onClick={async () => {
              if (profile.config.kind !== 'fortinet-sslvpn' || !error.certDigest) return
              await window.north.vpn.update(profile.id, {
                config: { ...profile.config, trustedCert: error.certDigest }
              })
              await queryClient.invalidateQueries({ queryKey: queryKeys.vpn.profiles })
              await connect(profile.id)
            }}
          >
            {t('vpn.actions.trustCert')}
          </Button>
        ) : null}
        {action === 'retry' ? (
          <Button size="sm" variant="outline" onClick={() => void connect(profile.id)}>
            {t('vpn.actions.retry')}
          </Button>
        ) : null}
        {action === 'install' ? (
          <Button size="sm" variant="outline" onClick={() => setShowInstall(true)}>
            {t('vpn.actions.install')}
          </Button>
        ) : null}
      </div>
      {showInstall ? <p className="mt-2 font-mono text-xs text-muted">{error.message}</p> : null}
    </div>
  )
}

function Overview({
  profile,
  state
}: {
  profile: VpnProfile
  state?: VpnState
}): React.JSX.Element {
  const { t } = useTranslation()
  const server =
    profile.config.kind === 'openvpn'
      ? profile.config.remoteSummary
          .map((r) => `${r.host}:${r.port} ${r.proto.toUpperCase()}`)
          .join(', ')
      : profile.config.kind === 'fortinet-sslvpn'
        ? `${profile.config.gateway}:${profile.config.port}`
        : profile.config.gateway
  const routes =
    state?.routes ?? (profile.config.kind === 'openvpn' ? profile.config.declaredRoutes : [])
  const fullTunnel = profile.config.kind === 'openvpn' && profile.config.redirectGateway
  const connected = state?.status === 'connected'
  return (
    <div className="space-y-4">
      <div aria-live="polite">
        <VpnStatusLabel state={state} />
        {state?.detail ? (
          <p className="mt-1 text-xs text-foreground" data-testid="vpn-detail">
            {state.detail}
          </p>
        ) : null}
      </div>
      <VpnErrorNotice profile={profile} state={state} />
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">{t('vpn.overview.server')}</dt>
        <dd className="font-mono text-foreground">{server}</dd>
        {connected && state?.localIp ? (
          <>
            <dt className="text-muted">{t('vpn.overview.ip')}</dt>
            <dd className="font-mono text-foreground" data-testid="vpn-local-ip">
              {state.localIp}
            </dd>
          </>
        ) : null}
        {connected ? (
          <>
            <dt className="text-muted">{t('vpn.overview.uptime')}</dt>
            <dd className="text-foreground">{formatRelativeDate(state.since)}</dd>
            <dt className="text-muted">{t('vpn.overview.sessions')}</dt>
            <dd className="text-foreground">
              {state.leases} ·{' '}
              {state.trigger === 'manual' ? t('vpn.overview.manual') : t('vpn.overview.auto')}
            </dd>
          </>
        ) : null}
        <dt className="text-muted">{t('vpn.overview.routes')}</dt>
        <dd className="font-mono text-xs text-foreground">
          {routes.length ? routes.join(', ') : t('vpn.overview.noRoutes')}
        </dd>
      </dl>
      {fullTunnel ? <p className="text-xs text-muted">{t('vpn.overview.fullTunnel')}</p> : null}
    </div>
  )
}

function Config({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: clients = [] } = useClients()
  const update = useUpdateVpn()
  const remove = useDeleteVpn()
  const [name, setName] = useState(profile.name)
  const [clientId, setClientId] = useState(profile.clientId ?? NO_CLIENT)
  const [autoDisconnect, setAutoDisconnect] = useState(profile.autoDisconnect === 'when-idle')
  const [idleMinutes, setIdleMinutes] = useState(String(Math.round(profile.idleTimeoutSec / 60)))
  const [notes, setNotes] = useState(profile.notes ?? '')
  const [confirm, setConfirm] = useState(false)

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    update.mutate({
      id: profile.id,
      input: {
        name: name.trim() || profile.name,
        clientId: clientId === NO_CLIENT ? null : clientId,
        autoDisconnect: autoDisconnect ? 'when-idle' : 'never',
        idleTimeoutSec: Math.max(1, Number(idleMinutes) || 5) * 60,
        notes: notes.trim() || null
      }
    })
  }

  return (
    <div className="max-w-lg space-y-8">
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('vpn.edit.connection')}
        </h3>
        {/* keyed by updatedAt so the draft resets to the saved config after each save */}
        <VpnConnectionEditor key={profile.updatedAt} profile={profile} />
      </section>

      <form className="space-y-3" onSubmit={save}>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('vpn.edit.general')}
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="vpn-cfg-name">{t('vpn.config.name')}</Label>
          <Input id="vpn-cfg-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vpn-cfg-client">{t('vpn.config.client')}</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="vpn-cfg-client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>{t('vpn.noClient')}</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="vpn-cfg-auto">{t('vpn.config.autoDisconnect')}</Label>
          <Switch id="vpn-cfg-auto" checked={autoDisconnect} onCheckedChange={setAutoDisconnect} />
        </div>
        {autoDisconnect ? (
          <div className="space-y-1.5">
            <Label htmlFor="vpn-cfg-idle">{t('vpn.config.idleTimeout')}</Label>
            <Input
              id="vpn-cfg-idle"
              type="number"
              min={1}
              className="w-28"
              value={idleMinutes}
              onChange={(e) => setIdleMinutes(e.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="vpn-cfg-notes">{t('vpn.config.notes')}</Label>
          <Textarea id="vpn-cfg-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending}>
            {t('vpn.config.save')}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
          {t('vpn.config.credentials')}
        </h3>
        <VpnCredentialsForm key={profile.updatedAt} profile={profile} />
      </section>

      <Button variant="destructive" onClick={() => setConfirm(true)} data-testid="vpn-delete">
        {t('vpn.actions.delete')}
      </Button>
      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('vpn.actions.delete')}
        description={t('vpn.confirmDelete', { name: profile.name })}
        confirming={remove.isPending}
        onConfirm={() => remove.mutateAsync(profile.id).then(() => setConfirm(false))}
      />
    </div>
  )
}

function Logs({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: lines = [] } = useVpnLogs(profile.id)
  const [filter, setFilter] = useState('')
  const visible = useMemo(
    () => (filter ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : lines),
    [lines, filter]
  )
  const diagnostics = (): string =>
    [`North VPN — ${profile.name} (${profile.kind})`, ...lines].join('\n')

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('vpn.logs.search')}
          aria-label={t('vpn.logs.search')}
          className="h-8"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copyToClipboard(diagnostics(), t('vpn.actions.copyDiagnostics'))}
          data-testid="vpn-copy-diagnostics"
        >
          {t('vpn.actions.copyDiagnostics')}
        </Button>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-muted">{t('vpn.logs.empty')}</p>
      ) : (
        <pre
          className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-foreground"
          data-testid="vpn-logs"
        >
          {visible.join('\n')}
        </pre>
      )}
    </div>
  )
}

function History({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: entries = [] } = useVpnHistory(profile.id)
  if (entries.length === 0) return <p className="text-xs text-muted">{t('vpn.history.empty')}</p>
  return (
    <ul
      className="divide-y divide-border rounded-md border border-border"
      data-testid="vpn-history"
    >
      {entries.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-muted">
            {formatRelativeDate(e.startedAt)} · {t(`vpn.history.${e.trigger}`)}
          </span>
          <span className="text-xs text-foreground">
            {t(`vpn.history.result.${e.result}`)}
            {e.errorCode ? ` · ${t(`vpn.errors.${e.errorCode}`)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
