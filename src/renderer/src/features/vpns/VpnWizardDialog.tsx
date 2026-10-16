import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useClients } from '@renderer/hooks/use-clients'
import { useCreateVpn, useImportOvpn, useVpnPlatformSupport } from '@renderer/hooks/use-vpn'
import { isWindowsPlatform } from '@renderer/lib/platform'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { vpnErrorFromUnknown } from '@renderer/lib/vpn-ui'
import { useVpnDialogsStore } from '@renderer/stores/vpn-dialogs-store'
import type { VpnConfig, VpnKind, VpnProfile } from '@shared/types'
import { FileKey, Globe, Network, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { OvpnSummary } from './OvpnSummary'
import { VpnCredentialsForm } from './VpnCredentialsForm'

const NO_CLIENT = '__none'

type Step = 'kind' | 'fortinet-sslvpn' | 'ipsec-ikev1' | 'ipsec-ikev2' | 'credentials'

/** Read an .ovpn and create the profile — shared by the wizard and the page's drop zone. */
export async function readOvpnFile(file: File): Promise<{ content: string; name: string }> {
  return { content: await file.text(), name: file.name.replace(/\.(ovpn|conf)$/i, '') }
}

export function VpnWizardDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const open = useVpnDialogsStore((s) => s.wizardOpen)
  const close = useVpnDialogsStore((s) => s.closeWizard)
  const [step, setStep] = useState<Step>('kind')
  const [created, setCreated] = useState<VpnProfile | null>(null)
  const navigate = useNavigate()

  const reset = (): void => {
    setStep('kind')
    setCreated(null)
  }

  const finish = (): void => {
    const id = created?.id
    close()
    reset()
    if (id) navigate(`/vpns?vpn=${id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
          reset()
        }
      }}
    >
      <DialogContent className="max-w-lg" data-testid="vpn-wizard">
        <DialogHeader>
          <DialogTitle>{created ? created.name : t('vpn.wizard.title')}</DialogTitle>
          <DialogDescription>
            {step === 'kind' ? t('vpn.wizard.chooseKind') : t('vpn.secrets.description')}
          </DialogDescription>
        </DialogHeader>

        {step === 'kind' ? (
          <KindStep
            onImported={(profile) => {
              setCreated(profile)
              setStep('credentials')
            }}
            onPick={(kind) => setStep(kind)}
          />
        ) : null}

        {step === 'fortinet-sslvpn' ? (
          <SslVpnStep
            onBack={() => setStep('kind')}
            onCreated={(profile) => {
              setCreated(profile)
              setStep('credentials')
            }}
          />
        ) : null}

        {step === 'ipsec-ikev1' || step === 'ipsec-ikev2' ? (
          <IpsecStep
            kind={step}
            onBack={() => setStep('kind')}
            onCreated={(profile) => {
              setCreated(profile)
              setStep('credentials')
            }}
          />
        ) : null}

        {step === 'credentials' && created ? (
          <div className="space-y-4">
            {created.config.kind === 'openvpn' ? <OvpnSummary config={created.config} /> : null}
            <VpnCredentialsForm profile={created} onSaved={finish} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function KindStep({
  onImported,
  onPick
}: {
  onImported: (profile: VpnProfile) => void
  onPick: (kind: 'fortinet-sslvpn' | 'ipsec-ikev1' | 'ipsec-ikev2') => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const importOvpn = useImportOvpn()
  const [importError, setImportError] = useState<string | null>(null)

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setImportError(null)
    try {
      const result = await importOvpn.mutateAsync(await readOvpnFile(file))
      toastSuccess(t('vpn.toast.imported'))
      onImported(result.profile)
    } catch (error) {
      // Shown inline: the reason (e.g. a blocked script directive) is what the user needs to act on.
      const parsed = vpnErrorFromUnknown(error)
      setImportError(parsed?.message ?? t('vpn.toast.importFailed'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const cards: Array<{
    id: string
    icon: typeof FileKey
    title: string
    hint: string
    onClick: () => void
  }> = [
    {
      id: 'openvpn',
      icon: FileKey,
      title: t('vpn.kind.openvpn'),
      hint: t('vpn.wizard.openvpnHint'),
      onClick: () => fileRef.current?.click()
    },
    {
      id: 'fortinet-sslvpn',
      icon: Globe,
      title: t('vpn.kind.fortinet-sslvpn'),
      hint: t('vpn.wizard.sslvpnHint'),
      onClick: () => onPick('fortinet-sslvpn')
    },
    {
      id: 'ipsec-ikev1',
      icon: ShieldCheck,
      title: t('vpn.kind.ipsec-ikev1'),
      hint: t('vpn.wizard.ipsecHint'),
      onClick: () => onPick('ipsec-ikev1')
    },
    {
      id: 'ipsec-ikev2',
      icon: Network,
      title: t('vpn.kind.ipsec-ikev2'),
      hint: t('vpn.wizard.ikev2Hint'),
      onClick: () => onPick('ipsec-ikev2')
    }
  ]

  return (
    <div className="grid gap-2">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          data-testid={`vpn-kind-${card.id}`}
          onClick={card.onClick}
          className="flex items-start gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <card.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{card.title}</span>
            <span className="block text-xs text-muted">{card.hint}</span>
          </span>
        </button>
      ))}
      {importError ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-foreground"
          role="alert"
          data-testid="vpn-import-error"
        >
          {importError}
        </p>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept=".ovpn,.conf"
        className="hidden"
        data-testid="vpn-ovpn-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )
}

function IpsecStep({
  kind,
  onBack,
  onCreated
}: {
  kind: 'ipsec-ikev1' | 'ipsec-ikev2'
  onBack: () => void
  onCreated: (profile: VpnProfile) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: clients = [] } = useClients()
  const { data: support } = useVpnPlatformSupport()
  const create = useCreateVpn()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(NO_CLIENT)
  const [gateway, setGateway] = useState('')
  const [username, setUsername] = useState('')
  const [groupName, setGroupName] = useState('')
  const [xauth, setXauth] = useState<'saved' | 'prompt'>('saved')
  const [ikev2Auth, setIkev2Auth] = useState<'eap' | 'psk'>('eap')

  const unsupported = support?.[kind as VpnKind]
  const valid = name.trim() && gateway.trim() && username.trim()

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!valid) return
    const config: VpnConfig =
      kind === 'ipsec-ikev1'
        ? {
            kind,
            gateway: gateway.trim(),
            username: username.trim(),
            xauth,
            ...(groupName.trim() ? { groupName: groupName.trim() } : {})
          }
        : {
            kind,
            gateway: gateway.trim(),
            username: username.trim(),
            auth: ikev2Auth,
            ...(groupName.trim() ? { remoteId: groupName.trim() } : {})
          }
    try {
      const profile = await create.mutateAsync({
        name: name.trim(),
        clientId: clientId === NO_CLIENT ? null : clientId,
        config
      })
      toastSuccess(t('vpn.toast.created'))
      onCreated(profile)
    } catch (error) {
      toastError(error, t('vpn.toast.saveFailed'))
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="vpn-ipsec-form">
      {kind === 'ipsec-ikev1' && isWindowsPlatform() ? (
        <p
          className="rounded-md border border-border bg-surface-elevated/50 p-2 text-xs text-muted"
          data-testid="vpn-windows-forti"
        >
          {t('vpn.wizard.windowsForti')}
        </p>
      ) : null}
      {unsupported && !unsupported.ok ? (
        <p className="text-xs text-muted" data-testid="vpn-unsupported">
          {t('vpn.wizard.unsupported', { reason: unsupported.reason })}
        </p>
      ) : null}

      <Field id="vpn-name" label={t('vpn.wizard.name')}>
        <Input id="vpn-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field id="vpn-client" label={t('vpn.wizard.client')}>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="vpn-client">
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
      </Field>
      {/* Same names and order as FortiClient so the user can copy from the old screen. */}
      <Field id="vpn-gateway" label={t('vpn.wizard.remoteGateway')}>
        <Input
          id="vpn-gateway"
          className="font-mono"
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          placeholder="vpn.cliente.fortiddns.com"
        />
      </Field>
      {kind === 'ipsec-ikev1' ? (
        <>
          <Field id="vpn-auth-method" label={t('vpn.wizard.authMethod')}>
            <Input id="vpn-auth-method" value={t('vpn.wizard.psk')} readOnly disabled />
          </Field>
          <Field id="vpn-group" label={t('vpn.wizard.groupName')}>
            <Input
              id="vpn-group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </Field>
          <Field id="vpn-xauth" label={t('vpn.wizard.xauth')}>
            <Select value={xauth} onValueChange={(v) => setXauth(v as 'saved' | 'prompt')}>
              <SelectTrigger id="vpn-xauth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved">{t('vpn.wizard.xauthSaved')}</SelectItem>
                <SelectItem value="prompt">{t('vpn.wizard.xauthPrompt')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : (
        <>
          <Field id="vpn-remote-id" label={t('vpn.wizard.remoteId')}>
            <Input
              id="vpn-remote-id"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </Field>
          <Field id="vpn-ikev2-auth" label={t('vpn.wizard.ikev2Auth')}>
            <Select value={ikev2Auth} onValueChange={(v) => setIkev2Auth(v as 'eap' | 'psk')}>
              <SelectTrigger id="vpn-ikev2-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eap">{t('vpn.wizard.eap')}</SelectItem>
                <SelectItem value="psk">{t('vpn.wizard.psk')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      <Field id="vpn-username" label={t('vpn.secrets.username')}>
        <Input id="vpn-username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>

      <div className="flex justify-between pt-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('vpn.wizard.back')}
        </Button>
        <Button type="submit" disabled={!valid || create.isPending} data-testid="vpn-ipsec-create">
          {t('vpn.wizard.next')}
        </Button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  children
}: {
  id: string
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

/** Mirrors FortiClient's SSL-VPN tab: connection name, remote gateway, custom port, username. */
function SslVpnStep({
  onBack,
  onCreated
}: {
  onBack: () => void
  onCreated: (profile: VpnProfile) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: clients = [] } = useClients()
  const { data: support } = useVpnPlatformSupport()
  const create = useCreateVpn()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(NO_CLIENT)
  const [gateway, setGateway] = useState('')
  const [port, setPort] = useState('443')
  const [username, setUsername] = useState('')

  // FortiClient shows "host:port" in the gateway field — split it once the user leaves the field
  // (splitting per keystroke would cut "1.2.3.4:4433" at the first port digit).
  const splitGateway = (): void => {
    const match = /^(.+):(\d{1,5})$/.exec(gateway.trim())
    if (match && !match[1].includes(':')) {
      setGateway(match[1])
      setPort(match[2])
    }
  }

  const portNumber = Number(port)
  const valid =
    name.trim() && gateway.trim() && username.trim() && portNumber >= 1 && portNumber <= 65535
  const unsupported = support?.['fortinet-sslvpn']

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!valid) return
    try {
      const profile = await create.mutateAsync({
        name: name.trim(),
        clientId: clientId === NO_CLIENT ? null : clientId,
        config: {
          kind: 'fortinet-sslvpn',
          gateway: gateway.trim(),
          port: portNumber,
          username: username.trim()
        }
      })
      toastSuccess(t('vpn.toast.created'))
      onCreated(profile)
    } catch (error) {
      toastError(error, t('vpn.toast.saveFailed'))
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="vpn-sslvpn-form">
      {unsupported && !unsupported.ok ? (
        <p className="text-xs text-muted" data-testid="vpn-unsupported">
          {t('vpn.wizard.unsupported', { reason: unsupported.reason })}
        </p>
      ) : null}
      <Field id="vpn-ssl-name" label={t('vpn.wizard.connectionName')}>
        <Input id="vpn-ssl-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field id="vpn-ssl-client" label={t('vpn.wizard.client')}>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="vpn-ssl-client">
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
      </Field>
      <Field id="vpn-ssl-gateway" label={t('vpn.wizard.remoteGateway')}>
        <Input
          id="vpn-ssl-gateway"
          className="font-mono"
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          onBlur={splitGateway}
          placeholder="179.190.99.2"
        />
      </Field>
      <Field id="vpn-ssl-port" label={t('vpn.wizard.customPort')}>
        <Input
          id="vpn-ssl-port"
          className="w-28 font-mono"
          inputMode="numeric"
          value={port}
          onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Field id="vpn-ssl-username" label={t('vpn.secrets.username')}>
        <Input
          id="vpn-ssl-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <div className="flex justify-between pt-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('vpn.wizard.back')}
        </Button>
        <Button type="submit" disabled={!valid || create.isPending} data-testid="vpn-sslvpn-create">
          {t('vpn.wizard.next')}
        </Button>
      </div>
    </form>
  )
}
