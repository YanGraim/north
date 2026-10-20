import { Button } from '@renderer/components/ui/button'
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
import { useCreateVpn, useVpnPlatformSupport } from '@renderer/hooks/use-vpn'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { type VpnProfile, type WindowsVpnProtocol, WindowsVpnProtocolSchema } from '@shared/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const NO_CLIENT = '__none'

/** Mirrors Windows' "Add a VPN connection": name, server, VPN type, user. */
export function WindowsVpnStep({
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
  const [protocol, setProtocol] = useState<WindowsVpnProtocol>('automatic')
  const [username, setUsername] = useState('')

  const valid = name.trim() && gateway.trim() && username.trim()
  const unsupported = support?.['windows-native']

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!valid) return
    try {
      const profile = await create.mutateAsync({
        name: name.trim(),
        clientId: clientId === NO_CLIENT ? null : clientId,
        config: {
          kind: 'windows-native',
          gateway: gateway.trim(),
          protocol,
          username: username.trim(),
          fullTunnel: false
        }
      })
      toastSuccess(t('vpn.toast.created'))
      onCreated(profile)
    } catch (error) {
      toastError(error, t('vpn.toast.saveFailed'))
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="vpn-windows-form">
      {unsupported && !unsupported.ok ? (
        <p className="text-xs text-muted" data-testid="vpn-unsupported">
          {t('vpn.wizard.unsupported', { reason: unsupported.reason })}
        </p>
      ) : null}
      <Row id="vpn-win-name" label={t('vpn.wizard.connectionName')}>
        <Input id="vpn-win-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Row>
      <Row id="vpn-win-client" label={t('vpn.wizard.client')}>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="vpn-win-client">
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
      </Row>
      <Row id="vpn-win-gateway" label={t('vpn.wizard.serverAddress')}>
        <Input
          id="vpn-win-gateway"
          className="font-mono"
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          placeholder="vpn.empresa.com.br"
        />
      </Row>
      <Row id="vpn-win-protocol" label={t('vpn.wizard.windowsProtocol')}>
        <WindowsProtocolSelect id="vpn-win-protocol" value={protocol} onChange={setProtocol} />
      </Row>
      <Row id="vpn-win-username" label={t('vpn.secrets.username')}>
        <Input
          id="vpn-win-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Row>
      <div className="flex justify-between pt-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('vpn.wizard.back')}
        </Button>
        <Button
          type="submit"
          disabled={!valid || create.isPending}
          data-testid="vpn-windows-create"
        >
          {t('vpn.wizard.next')}
        </Button>
      </div>
    </form>
  )
}

export function WindowsProtocolSelect({
  id,
  value,
  onChange
}: {
  id: string
  value: WindowsVpnProtocol
  onChange: (protocol: WindowsVpnProtocol) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Select value={value} onValueChange={(v) => onChange(v as WindowsVpnProtocol)}>
      <SelectTrigger id={id} data-testid={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WindowsVpnProtocolSchema.options.map((p) => (
          <SelectItem key={p} value={p}>
            {t(`vpn.windowsProtocol.${p}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Row({
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
