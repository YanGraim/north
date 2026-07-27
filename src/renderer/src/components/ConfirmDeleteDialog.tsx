import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'

export type CascadeSummary = {
  environments?: number
  groups?: number
  connections?: number
  tagUses?: number
}

type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  cascade?: CascadeSummary
  confirming?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  cascade,
  confirming = false,
  onConfirm
}: ConfirmDeleteDialogProps): React.JSX.Element {
  const cascadeLines = buildCascadeLines(cascade)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-xs text-muted">
              <p>{description}</p>
              {cascadeLines.length > 0 ? (
                <ul className="list-inside list-disc space-y-0.5 text-muted">
                  {cascadeLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirming}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {confirming ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function buildCascadeLines(cascade?: CascadeSummary): string[] {
  if (!cascade) return []
  const lines: string[] = []
  if (cascade.environments !== undefined && cascade.environments > 0) {
    lines.push(
      `${cascade.environments} ambiente${cascade.environments === 1 ? '' : 's'} serão excluídos`
    )
  }
  if (cascade.groups !== undefined && cascade.groups > 0) {
    lines.push(`${cascade.groups} grupo${cascade.groups === 1 ? '' : 's'} serão excluídos`)
  }
  if (cascade.connections !== undefined && cascade.connections > 0) {
    lines.push(
      `${cascade.connections} conexão${cascade.connections === 1 ? '' : 'ões'} serão excluídas`
    )
  }
  if (cascade.tagUses !== undefined && cascade.tagUses > 0) {
    lines.push(`Usada em ${cascade.tagUses} conexão${cascade.tagUses === 1 ? '' : 'ões'}`)
  }
  return lines
}
