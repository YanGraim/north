import { toastError, toastSuccess } from '@renderer/lib/toast'

export type UpdateCheckResult = {
  available: boolean
  version: string | null
  /** True quando o updater está desligado (dev sem NORTH_ENABLE_UPDATES). */
  disabledInDev: boolean
}

/** Em `electron-vite dev` o updater fica off salvo NORTH_ENABLE_UPDATES no main. */
export function updatesLikelyDisabledInDev(): boolean {
  return Boolean(import.meta.env.DEV)
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const disabledInDev = updatesLikelyDisabledInDev()
  try {
    const result = await window.north.updates.check()
    if (result.available && result.version) {
      toastSuccess(`Nova versão disponível: ${result.version}`)
    } else if (disabledInDev) {
      toastSuccess('Atualizações desabilitadas em desenvolvimento')
    } else {
      toastSuccess('Você está na versão mais recente')
    }
    return { ...result, disabledInDev }
  } catch (error: unknown) {
    toastError(error, 'Falha ao verificar atualizações')
    throw error
  }
}

export async function installAndRestart(): Promise<void> {
  try {
    toastSuccess('Baixando atualização… o app reinicia em seguida')
    await window.north.updates.install()
  } catch (error: unknown) {
    toastError(error, 'Falha ao instalar atualização')
    throw error
  }
}
