import { toastError } from '@renderer/lib/toast'
import { vpnErrorAction, vpnErrorFromUnknown } from '@renderer/lib/vpn-ui'
import { useVpnDialogsStore } from '@renderer/stores/vpn-dialogs-store'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The single "turn this VPN on" flow: check conflicts first (ask the user),
 * then connect; credential errors open the credentials dialog in place.
 */
export function useVpnConnect(): {
  connect: (profileId: string) => Promise<void>
  connectNow: (profileId: string, force?: boolean) => Promise<void>
} {
  const { t } = useTranslation()
  const openConflict = useVpnDialogsStore((s) => s.openConflict)
  const openSecrets = useVpnDialogsStore((s) => s.openSecrets)

  const connectNow = useCallback(
    async (profileId: string, force = false) => {
      try {
        await window.north.vpn.connect({ profileId, force })
      } catch (error) {
        const parsed = vpnErrorFromUnknown(error)
        if (parsed?.code === 'CONFLICT') {
          openConflict(profileId, await window.north.vpn.checkConflicts(profileId))
          return
        }
        if (parsed && vpnErrorAction(parsed.code) === 'update-secret') {
          openSecrets(profileId)
          return
        }
        // State events already carry lastError for the inline UI; toast as a heads-up.
        toastError(parsed ? new Error(t(`vpn.errors.${parsed.code}`)) : error)
      }
    },
    [openConflict, openSecrets, t]
  )

  const connect = useCallback(
    async (profileId: string) => {
      const conflicts = await window.north.vpn.checkConflicts(profileId)
      if (conflicts.length > 0) {
        openConflict(profileId, conflicts)
        return
      }
      await connectNow(profileId)
    },
    [connectNow, openConflict]
  )

  return { connect, connectNow }
}
