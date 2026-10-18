import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useVpnProfiles } from '@renderer/hooks/use-vpn'
import type { VpnMode } from '@shared/types'
import { useTranslation } from 'react-i18next'

const NONE = '__none__'
const INHERIT = '__inherit__'

/** Client/Environment: which VPN its sessions bring up (or none). */
export function VpnLinkSelect({
  id,
  value,
  onChange
}: {
  id: string
  value: string | null
  onChange: (profileId: string | null) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: profiles = [] } = useVpnProfiles()
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} data-testid="vpn-link-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('vpn.link.none')}</SelectItem>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Connection/Access: inherit from Environment/Client, never, or a specific VPN. */
export function VpnModeSelect({
  id,
  mode,
  profileId,
  onChange
}: {
  id: string
  mode: VpnMode
  profileId: string | null
  onChange: (next: { vpnMode: VpnMode; vpnProfileId: string | null }) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: profiles = [] } = useVpnProfiles()
  const value = mode === 'inherit' ? INHERIT : mode === 'none' ? NONE : (profileId ?? INHERIT)
  return (
    <Select
      value={value}
      onValueChange={(v) =>
        onChange(
          v === INHERIT
            ? { vpnMode: 'inherit', vpnProfileId: null }
            : v === NONE
              ? { vpnMode: 'none', vpnProfileId: null }
              : { vpnMode: 'profile', vpnProfileId: v }
        )
      }
    >
      <SelectTrigger id={id} data-testid="vpn-mode-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={INHERIT}>{t('vpn.link.inherit')}</SelectItem>
        <SelectItem value={NONE}>{t('vpn.link.never')}</SelectItem>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
