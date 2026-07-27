import { toastCopied, toastError } from '@renderer/lib/toast'

export async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toastCopied(label)
  } catch (error) {
    toastError(error, 'Não foi possível copiar')
  }
}
