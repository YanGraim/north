import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { TransferProgress } from '@shared/protocols'
import { ArrowDownToLine, ArrowUpFromLine, Check, X } from 'lucide-react'
import { formatSize } from './paths'

type TransferQueueProps = {
  transfers: TransferProgress[]
  onCancel: (transferId: string) => void
  onClearFinished: () => void
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

export function TransferQueue({
  transfers,
  onCancel,
  onClearFinished
}: TransferQueueProps): React.JSX.Element | null {
  if (transfers.length === 0) return null
  const finished = transfers.some((t) => t.done)
  return (
    <div
      className="max-h-40 overflow-y-auto border-t border-border bg-surface"
      data-testid="transfer-queue"
    >
      <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted">
        <span>Transferências</span>
        {finished ? (
          <button type="button" className="hover:text-foreground" onClick={onClearFinished}>
            Limpar concluídas
          </button>
        ) : null}
      </div>
      {transfers.map((t) => {
        const pct =
          t.totalBytes && t.totalBytes > 0
            ? Math.min(100, Math.round((t.bytesTransferred / t.totalBytes) * 100))
            : null
        const Icon = t.direction === 'download' ? ArrowDownToLine : ArrowUpFromLine
        const name = baseName(t.direction === 'download' ? t.remotePath : (t.localPath ?? ''))
        const status = t.error
          ? t.error
          : t.cancelled
            ? 'Cancelada'
            : t.done
              ? 'Concluída'
              : [
                  t.filesTotal && t.filesTotal > 1 ? `${t.filesDone ?? 0}/${t.filesTotal}` : null,
                  t.currentFile && t.filesTotal && t.filesTotal > 1 ? t.currentFile : null,
                  t.totalBytes
                    ? `${formatSize(t.bytesTransferred)} de ${formatSize(t.totalBytes)}`
                    : formatSize(t.bytesTransferred)
                ]
                  .filter(Boolean)
                  .join(' · ')
        return (
          <div key={t.transferId} className="flex items-center gap-2 px-3 py-1 text-xs">
            <Icon className="size-3.5 shrink-0 text-muted" />
            <span className="w-48 shrink-0 truncate">{name}</span>
            <div className="h-1.5 w-32 shrink-0 overflow-hidden rounded bg-border">
              <div
                className={cn(
                  'h-full',
                  t.error ? 'bg-red-500' : t.cancelled ? 'bg-muted' : 'bg-accent'
                )}
                style={{ width: `${t.done ? 100 : (pct ?? 0)}%` }}
              />
            </div>
            <span
              className={cn(
                'min-w-0 flex-1 truncate font-mono text-muted',
                t.error && 'text-red-400'
              )}
            >
              {status}
            </span>
            {t.done ? (
              t.error || t.cancelled ? null : (
                <Check className="size-3.5 text-accent" aria-label="Concluída" />
              )
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Cancelar ${name}`}
                onClick={() => onCancel(t.transferId)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
