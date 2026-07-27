import { toast } from '@renderer/components/ui/sonner'
import { formatIpcError } from '@renderer/lib/ipc-error'

export function toastSuccess(message: string): void {
  toast.success(message)
}

export function toastError(error: unknown, fallback = 'Algo deu errado'): void {
  toast.error(formatIpcError(error, fallback))
}

export function toastCopied(label: string): void {
  toast.success(`${label} copiado`)
}
