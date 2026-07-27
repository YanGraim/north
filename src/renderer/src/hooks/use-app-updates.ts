import { toastError } from '@renderer/lib/toast'
import {
  installAndRestart,
  showUpdateDownloadingToast,
  showUpdateReadyToast,
  updatesLikelyDisabledInDev
} from '@renderer/lib/update-actions'
import type { UpdateStatus } from '@shared/types'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** Verificação na abertura (main) + toasts quando há update ou download concluído. */
export function useAppUpdates(): void {
  const { t } = useTranslation()
  const toastedRef = useRef<{
    downloading: string | null
    ready: string | null
    error: string | null
  }>({
    downloading: null,
    ready: null,
    error: null
  })

  useEffect(() => {
    if (updatesLikelyDisabledInDev()) return

    function maybeToast(status: UpdateStatus): void {
      if (!status.enabled) return

      if (status.error && toastedRef.current.error !== status.error) {
        toastedRef.current.error = status.error
        toastError(status.error)
      }

      if (
        status.available &&
        status.version &&
        status.downloading &&
        !status.downloaded &&
        toastedRef.current.downloading !== status.version
      ) {
        toastedRef.current.downloading = status.version
        showUpdateDownloadingToast(status.version, t('updates.toast.downloading'), status.progress)
      }

      if (status.downloaded && status.version && toastedRef.current.ready !== status.version) {
        toastedRef.current.ready = status.version
        showUpdateReadyToast(
          status.version,
          {
            message: t('updates.toast.ready'),
            action: t('updates.toast.install')
          },
          () => {
            void installAndRestart()
          }
        )
      }
    }

    void window.north.updates.getStatus().then(maybeToast)

    const unsubscribe = window.north.updates.onStatusChanged((status) => {
      maybeToast(status)
    })

    return unsubscribe
  }, [t])
}
