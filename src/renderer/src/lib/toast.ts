import { toast } from '@renderer/components/ui/sonner'

export function toastSuccess(message: string): void {
  toast.success(message)
}

export function toastError(error: unknown, fallback = 'Algo deu errado'): void {
  const message = error instanceof Error && error.message ? error.message : fallback
  toast.error(message)
}

export function toastCopied(label: string): void {
  toast.success(`${label} copiado`)
}
