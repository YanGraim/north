import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import type { TransferConflict } from '@shared/protocols'

type ConflictDialogProps = {
  /** Names that already exist at the destination; null closes the dialog. */
  names: string[] | null
  onResolve: (choice: TransferConflict | null) => void
}

export function ConflictDialog({ names, onResolve }: ConflictDialogProps): React.JSX.Element {
  const shown = names?.slice(0, 8) ?? []
  const more = (names?.length ?? 0) - shown.length
  return (
    <AlertDialog
      open={names !== null}
      onOpenChange={(open) => {
        if (!open) onResolve(null)
      }}
    >
      <AlertDialogContent data-testid="transfer-conflict-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {names?.length === 1 ? 'Já existe no destino' : 'Já existem no destino'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-xs text-muted">
              <ul className="list-inside list-disc font-mono">
                {shown.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
                {more > 0 ? <li>e mais {more}</li> : null}
              </ul>
              <p>
                A escolha vale também para os arquivos dentro das pastas. Pastas com o mesmo nome
                são mescladas.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onResolve(null)}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={() => onResolve('skip')}>
            Pular existentes
          </Button>
          <Button type="button" onClick={() => onResolve('overwrite')}>
            Sobrescrever
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
