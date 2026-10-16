import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useSetVpnSecrets, useVpnSecretStatus } from '@renderer/hooks/use-vpn'
import { queryKeys } from '@renderer/lib/query-keys'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import { requiredSecretFields, type VpnSecretField } from '@renderer/lib/vpn-ui'
import type { VpnProfile, VpnSecretKind } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function currentUsername(profile: VpnProfile): string {
  return profile.config.kind === 'openvpn'
    ? (profile.config.username ?? '')
    : profile.config.username
}

/**
 * Asks only for what this profile needs. Secrets go straight to the vault via
 * `vpn:set-secret`; the form never reads a saved value back (blank = keep).
 */
export function VpnCredentialsForm({
  profile,
  onSaved,
  submitLabel
}: {
  profile: VpnProfile
  onSaved?: () => void
  submitLabel?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fields = requiredSecretFields(profile.config)
  const { data: status } = useVpnSecretStatus(profile.id)
  const setSecrets = useSetVpnSecrets()
  const [values, setValues] = useState<Partial<Record<VpnSecretField, string>>>({
    username: currentUsername(profile)
  })
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setSaving(true)
    try {
      const username = (values.username ?? '').trim()
      if (fields.includes('username') && username !== currentUsername(profile)) {
        await window.north.vpn.update(profile.id, { config: { ...profile.config, username } })
        await queryClient.invalidateQueries({ queryKey: queryKeys.vpn.profiles })
      }
      const secrets = fields
        .filter((f): f is VpnSecretKind => f !== 'username')
        .filter((f) => (values[f] ?? '') !== '')
        .map((kind) => ({ profileId: profile.id, kind, secret: values[kind] as string }))
      await setSecrets.mutateAsync(secrets)
      toastSuccess(t('vpn.toast.secretsSaved'))
      onSaved?.()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} data-testid="vpn-credentials-form">
      {fields.length === 0 ? (
        <p className="text-xs text-muted">{t('vpn.wizard.noSecrets')}</p>
      ) : null}
      {fields.map((field) => {
        const id = `vpn-secret-${field}`
        const saved = field !== 'username' && status?.[field]
        return (
          <div key={field} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={id}>{t(`vpn.secrets.${field}`)}</Label>
              {field !== 'username' ? (
                <span className="text-[11px] text-muted">
                  {saved ? t('vpn.config.saved') : t('vpn.config.missing')}
                </span>
              ) : null}
            </div>
            <Input
              id={id}
              data-testid={id}
              type={field === 'username' ? 'text' : 'password'}
              autoComplete="off"
              value={values[field] ?? ''}
              placeholder={saved ? t('vpn.secrets.keepHint') : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            />
          </div>
        )
      })}
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={saving} data-testid="vpn-credentials-save">
          {submitLabel ?? t('vpn.actions.saveSecrets')}
        </Button>
      </div>
    </form>
  )
}
