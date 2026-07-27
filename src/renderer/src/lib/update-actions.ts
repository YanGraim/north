import { toast } from '@renderer/components/ui/sonner'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import type { UpdateStatus } from '@shared/types'

export type UpdateCheckResult = UpdateStatus & {
  /** True quando o updater está desligado (dev sem NORTH_ENABLE_UPDATES). */
  disabledInDev: boolean
}

/** Em `electron-vite dev` o updater fica off salvo NORTH_ENABLE_UPDATES no main. */
export function updatesLikelyDisabledInDev(): boolean {
  return Boolean(import.meta.env.DEV)
}

function describeCheckResult(status: UpdateStatus, disabledInDev: boolean): string | null {
  if (status.error) {
    return status.error
  }
  if (status.available && status.version) {
    if (status.downloaded) {
      return `Atualização ${status.version} pronta para instalar`
    }
    if (status.downloading) {
      const percent = status.progress != null ? ` (${Math.round(status.progress)}%)` : ''
      return `Baixando versão ${status.version}${percent}…`
    }
    return `Nova versão disponível: ${status.version}`
  }
  if (disabledInDev) {
    return 'Atualizações desabilitadas em desenvolvimento'
  }
  return 'Você está na versão mais recente'
}

export async function checkForUpdates(options?: { silent?: boolean }): Promise<UpdateCheckResult> {
  const disabledInDev = updatesLikelyDisabledInDev()
  const silent = options?.silent ?? false

  try {
    const status = await window.north.updates.check()
    const message = describeCheckResult(status, disabledInDev)

    if (!silent && message) {
      if (status.error) {
        toastError(status.error)
      } else {
        toastSuccess(message)
      }
    }

    return { ...status, disabledInDev }
  } catch (error: unknown) {
    if (!silent) {
      toastError(error, 'Falha ao verificar atualizações')
    }
    throw error
  }
}

export async function installAndRestart(): Promise<void> {
  try {
    await window.north.updates.install()
  } catch (error: unknown) {
    toastError(error, 'Falha ao instalar atualização')
    throw error
  }
}

export function showUpdateReadyToast(
  version: string,
  labels: { message: string; action: string },
  onInstall: () => void
): void {
  toast.success(labels.message.replace('{{version}}', version), {
    action: {
      label: labels.action,
      onClick: onInstall
    }
  })
}

export function showUpdateDownloadingToast(
  version: string,
  message: string,
  progress: number | null
): void {
  const percent = progress != null ? ` (${Math.round(progress)}%)` : ''
  toast.info(message.replace('{{version}}', version).replace('{{percent}}', percent))
}
