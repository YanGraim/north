import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useVpnProfiles } from '@renderer/hooks/use-vpn'
import { useVpnDialogsStore } from '@renderer/stores/vpn-dialogs-store'
import { useTranslation } from 'react-i18next'
import { useVpnConnect } from './use-vpn-connect'
import { VpnCredentialsForm } from './VpnCredentialsForm'
import { VpnWizardDialog } from './VpnWizardDialog'

/** Mounted once in the AppShell so any surface (titlebar, /vpns, sessions) can open them. */
export function VpnDialogs(): React.JSX.Element {
  return (
    <>
      <VpnWizardDialog />
      <VpnSecretsDialog />
      <VpnConflictDialog />
    </>
  )
}

function VpnSecretsDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const profileId = useVpnDialogsStore((s) => s.secretsFor)
  const close = useVpnDialogsStore((s) => s.closeSecrets)
  const { data: profiles = [] } = useVpnProfiles()
  const profile = profiles.find((p) => p.id === profileId)

  return (
    <Dialog open={Boolean(profile)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md" data-testid="vpn-secrets-dialog">
        <DialogHeader>
          <DialogTitle>{t('vpn.secrets.title', { name: profile?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('vpn.secrets.description')}</DialogDescription>
        </DialogHeader>
        {profile ? <VpnCredentialsForm key={profile.id} profile={profile} onSaved={close} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function VpnConflictDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const conflict = useVpnDialogsStore((s) => s.conflict)
  const close = useVpnDialogsStore((s) => s.closeConflict)
  const { data: profiles = [] } = useVpnProfiles()
  const { connectNow } = useVpnConnect()
  const name = (id: string) => profiles.find((p) => p.id === id)?.name ?? id

  const disconnectOthersAndConnect = async (): Promise<void> => {
    if (!conflict) return
    close()
    const others = [...new Set(conflict.conflicts.map((c) => c.withProfileId))]
    await Promise.all(others.map((id) => window.north.vpn.disconnect(id)))
    await connectNow(conflict.profileId)
  }

  const connectAnyway = async (): Promise<void> => {
    if (!conflict) return
    close()
    await connectNow(conflict.profileId, true)
  }

  return (
    <Dialog open={Boolean(conflict)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md" data-testid="vpn-conflict-dialog">
        <DialogHeader>
          <DialogTitle>{t('vpn.conflict.title')}</DialogTitle>
          <DialogDescription>
            {t('vpn.conflict.description', { name: conflict ? name(conflict.profileId) : '' })}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
          {conflict?.conflicts.map((c) => (
            <li key={`${c.type}-${c.withProfileId}`}>
              {t(`vpn.conflict.${c.type}`, {
                other: name(c.withProfileId),
                detail: c.detail ?? ''
              })}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={close}>
            {t('vpn.conflict.cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void connectAnyway()}
            data-testid="vpn-conflict-anyway"
          >
            {t('vpn.conflict.connectAnyway')}
          </Button>
          <Button
            onClick={() => void disconnectOthersAndConnect()}
            data-testid="vpn-conflict-switch"
          >
            {t('vpn.conflict.disconnectAndConnect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
