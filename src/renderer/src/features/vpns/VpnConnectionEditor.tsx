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
import { useImportOvpn, useUpdateVpn } from '@renderer/hooks/use-vpn'
import { isWindowsPlatform } from '@renderer/lib/platform'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import {
  applyConnectionEdit,
  type GatewayKind,
  switchVpnKind,
  vpnErrorFromUnknown
} from '@renderer/lib/vpn-ui'
import { normalizeFortinetConfig } from '@shared/lib/vpn/host-port'
import type { VpnConfig, VpnProfile } from '@shared/types'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OvpnSummary } from './OvpnSummary'
import { readOvpnFile } from './VpnWizardDialog'
import { WindowsProtocolSelect } from './WindowsVpnStep'

const GATEWAY_KINDS: GatewayKind[] = ['fortinet-sslvpn', 'ipsec-ikev1', 'ipsec-ikev2']
/** Windows' own client is only offered where it exists (or when the profile already uses it). */
const kindsFor = (current: VpnConfig['kind']): GatewayKind[] =>
  isWindowsPlatform() || current === 'windows-native'
    ? [...GATEWAY_KINDS, 'windows-native']
    : GATEWAY_KINDS

/**
 * Edit how the VPN connects (type, gateway, port, user…) in place — no delete-and-recreate.
 * Saved credentials stay; the credentials form below then asks for whatever the new type needs.
 */
export function VpnConnectionEditor({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const update = useUpdateVpn()
  const [draft, setDraft] = useState<VpnConfig>(profile.config)
  const [dnsText, setDnsText] = useState(
    profile.config.kind === 'ipsec-ikev1' ? (profile.config.dnsDomains ?? []).join(', ') : ''
  )
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(profile.config) ||
    (profile.config.kind === 'ipsec-ikev1' &&
      JSON.stringify(parseDomains(dnsText)) !== JSON.stringify(profile.config.dnsDomains))

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    const withDns: VpnConfig =
      draft.kind === 'ipsec-ikev1' ? { ...draft, dnsDomains: parseDomains(dnsText) } : draft
    update.mutate({
      id: profile.id,
      input: { config: applyConnectionEdit(profile.config, normalizeFortinetConfig(withDns)) }
    })
  }

  if (draft.kind === 'openvpn') {
    return <OpenVpnEditor profile={profile} />
  }

  const set = (patch: Partial<VpnConfig>): void =>
    setDraft((d) => ({ ...d, ...patch }) as VpnConfig)
  const valid = draft.gateway.trim() && draft.username.trim()

  return (
    <form className="space-y-3" onSubmit={save} data-testid="vpn-connection-editor">
      <Row id="vpn-edit-kind" label={t('vpn.edit.type')}>
        <Select
          value={draft.kind}
          onValueChange={(kind) => setDraft((d) => switchVpnKind(d, kind as GatewayKind))}
        >
          <SelectTrigger id="vpn-edit-kind" data-testid="vpn-edit-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindsFor(profile.config.kind).map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`vpn.kind.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row id="vpn-edit-gateway" label={t('vpn.wizard.remoteGateway')}>
        <Input
          id="vpn-edit-gateway"
          className="font-mono"
          value={draft.gateway}
          onChange={(e) => set({ gateway: e.target.value })}
          onBlur={() => setDraft((d) => normalizeFortinetConfig(d))}
        />
      </Row>
      {draft.kind === 'fortinet-sslvpn' ? (
        <Row id="vpn-edit-port" label={t('vpn.wizard.customPort')}>
          <Input
            id="vpn-edit-port"
            className="w-28 font-mono"
            inputMode="numeric"
            value={String(draft.port)}
            onChange={(e) => set({ port: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </Row>
      ) : null}
      {draft.kind === 'ipsec-ikev1' ? (
        <>
          <Row id="vpn-edit-group" label={t('vpn.wizard.groupName')}>
            <Input
              id="vpn-edit-group"
              value={draft.groupName ?? ''}
              onChange={(e) => set({ groupName: e.target.value || undefined })}
            />
          </Row>
          <Row id="vpn-edit-dns-domains" label={t('vpn.edit.dnsDomains')}>
            <Input
              id="vpn-edit-dns-domains"
              className="font-mono"
              placeholder="poly.local, corp.example"
              value={dnsText}
              onChange={(e) => setDnsText(e.target.value)}
              onBlur={() => set({ dnsDomains: parseDomains(dnsText) })}
              data-testid="vpn-edit-dns-domains"
            />
            <p className="text-xs text-muted">{t('vpn.edit.dnsDomainsHint')}</p>
          </Row>
          <Row id="vpn-edit-xauth" label={t('vpn.wizard.xauth')}>
            <Select
              value={draft.xauth}
              onValueChange={(v) => set({ xauth: v as 'saved' | 'prompt' })}
            >
              <SelectTrigger id="vpn-edit-xauth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved">{t('vpn.wizard.xauthSaved')}</SelectItem>
                <SelectItem value="prompt">{t('vpn.wizard.xauthPrompt')}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      ) : null}
      {draft.kind === 'ipsec-ikev2' ? (
        <>
          <Row id="vpn-edit-remote-id" label={t('vpn.wizard.remoteId')}>
            <Input
              id="vpn-edit-remote-id"
              value={draft.remoteId ?? ''}
              onChange={(e) => set({ remoteId: e.target.value || undefined })}
            />
          </Row>
          <Row id="vpn-edit-ikev2-auth" label={t('vpn.wizard.ikev2Auth')}>
            <Select value={draft.auth} onValueChange={(v) => set({ auth: v as 'eap' | 'psk' })}>
              <SelectTrigger id="vpn-edit-ikev2-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eap">{t('vpn.wizard.eap')}</SelectItem>
                <SelectItem value="psk">{t('vpn.wizard.psk')}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      ) : null}
      {draft.kind === 'windows-native' ? (
        <Row id="vpn-edit-win-protocol" label={t('vpn.wizard.windowsProtocol')}>
          <WindowsProtocolSelect
            id="vpn-edit-win-protocol"
            value={draft.protocol}
            onChange={(protocol) => set({ protocol })}
          />
        </Row>
      ) : null}
      <Row id="vpn-edit-username" label={t('vpn.secrets.username')}>
        <Input
          id="vpn-edit-username"
          value={draft.username}
          onChange={(e) => set({ username: e.target.value })}
        />
      </Row>
      <div className="flex justify-end gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(profile.config)
              setDnsText(
                profile.config.kind === 'ipsec-ikev1'
                  ? (profile.config.dnsDomains ?? []).join(', ')
                  : ''
              )
            }}
          >
            {t('vpn.edit.discard')}
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={!dirty || !valid || update.isPending}
          data-testid="vpn-edit-save"
        >
          {t('vpn.edit.save')}
        </Button>
      </div>
    </form>
  )
}

function OpenVpnEditor({ profile }: { profile: VpnProfile }): React.JSX.Element {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const replace = useImportOvpn()
  const [error, setError] = useState<string | null>(null)

  const onFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setError(null)
    try {
      const { content } = await readOvpnFile(file)
      await replace.mutateAsync({ content, profileId: profile.id })
      toastSuccess(t('vpn.edit.ovpnReplaced'))
    } catch (e) {
      const parsed = vpnErrorFromUnknown(e)
      setError(parsed?.message ?? t('vpn.toast.importFailed'))
      if (!parsed) toastError(e)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3" data-testid="vpn-connection-editor">
      {profile.config.kind === 'openvpn' ? <OvpnSummary config={profile.config} /> : null}
      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        data-testid="vpn-replace-ovpn"
      >
        {t('vpn.edit.replaceOvpn')}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".ovpn,.conf"
        className="hidden"
        data-testid="vpn-replace-ovpn-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )
}

/** "poly.local, corp.example" → ['poly.local', 'corp.example']; empty → undefined */
function parseDomains(text: string): string[] | undefined {
  const domains = text
    .split(/[\s,;]+/)
    .map((d) =>
      d
        .trim()
        .replace(/^\.+|\.+$/g, '')
        .toLowerCase()
    )
    .filter(Boolean)
  return domains.length ? [...new Set(domains)] : undefined
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
