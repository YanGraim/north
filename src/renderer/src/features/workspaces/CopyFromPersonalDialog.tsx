import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Label } from '@renderer/components/ui/label'
import { useCurrentWorkspace } from '@renderer/hooks/use-workspaces'
import { formatIpcError } from '@renderer/lib/ipc-error'
import { type CopyToWorkspaceReport, LOCAL_WORKSPACE_ID } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invalidateWorkspaceCache } from './WorkspaceScope'

type Totals = CopyToWorkspaceReport['created'] & { passwords: number }

const emptyTotals = (): Totals => ({
  clients: 0,
  environments: 0,
  groups: 0,
  connections: 0,
  accesses: 0,
  passwords: 0
})

/**
 * "Copiar do Meu workspace…" (REC-023): picks several personal clients and
 * copies each, whole, into the current organization: environments, groups,
 * connections, accesses, tags, VPN links and (optionally) passwords. The
 * copies are new and unlinked, exactly like "Copiar para workspace…".
 */
export function CopyFromPersonalDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const organization = useCurrentWorkspace()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includePasswords, setIncludePasswords] = useState(true)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const personal = useQuery({
    queryKey: ['workspaces', 'copy-targets', LOCAL_WORKSPACE_ID],
    queryFn: () => window.north.workspaces.copyTargets(LOCAL_WORKSPACE_ID),
    enabled: open,
    staleTime: 0
  })
  const clients = personal.data?.clients ?? []

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setIncludePasswords(true)
    setProgress(null)
    setTotals(null)
    setWarnings([])
  }, [open])

  const busy = progress !== null && totals === null
  const toggle = (id: string, on: boolean): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const allOn = clients.length > 0 && selected.size === clients.length

  const copy = async (): Promise<void> => {
    if (!organization || selected.size === 0) return
    const ids = clients.filter((c) => selected.has(c.id))
    const sum = emptyTotals()
    const notes: string[] = []
    setProgress({ done: 0, total: ids.length })
    for (const [index, client] of ids.entries()) {
      try {
        const report = await window.north.workspaces.copy({
          kind: 'client',
          id: client.id,
          sourceWorkspaceId: LOCAL_WORKSPACE_ID,
          targetWorkspaceId: organization.id,
          targetParentId: null,
          includePasswords
        })
        for (const key of Object.keys(report.created) as Array<keyof typeof report.created>) {
          sum[key] += report.created[key]
        }
        sum.passwords += report.passwordsCopied
        for (const warning of report.warnings) notes.push(`${client.name}: ${warning}`)
      } catch (e) {
        notes.push(`${client.name}: ${formatIpcError(e, t('workspaces.copy.failed'))}`)
      }
      setProgress({ done: index + 1, total: ids.length })
    }
    invalidateWorkspaceCache(organization.id)
    setWarnings(notes)
    setTotals(sum)
  }

  const summary = totals
    ? [
        t('workspaces.copy.clients', { count: totals.clients }),
        totals.connections && t('workspaces.copy.connections', { count: totals.connections }),
        totals.accesses && t('workspaces.copy.accesses', { count: totals.accesses }),
        totals.passwords && t('workspaces.copy.passwords', { count: totals.passwords })
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-md" data-testid="copy-from-personal">
        <DialogHeader>
          <DialogTitle>{t('workspaces.copyFrom.title')}</DialogTitle>
          <DialogDescription>
            {t('workspaces.copyFrom.description', { workspace: organization?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        {totals ? (
          <div className="flex flex-col gap-2" data-testid="copy-from-report">
            <p className="text-sm text-foreground">
              {t('workspaces.copy.done', { workspace: organization?.name ?? '' })}
            </p>
            <p className="font-mono text-xs text-muted">{summary}</p>
            {warnings.length > 0 ? (
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-xs text-amber-400">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <DialogFooter className="mt-2">
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('workspaces.copy.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void copy()
            }}
          >
            {personal.isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted" aria-hidden />
            ) : clients.length === 0 ? (
              <p className="text-sm text-muted">{t('workspaces.copyFrom.empty')}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 border-b border-border pb-1.5">
                  <Checkbox
                    id="copy-from-all"
                    checked={allOn}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? new Set(clients.map((c) => c.id)) : new Set())
                    }
                  />
                  <Label htmlFor="copy-from-all" className="text-xs text-muted">
                    {t('workspaces.copyFrom.all', { count: clients.length })}
                  </Label>
                </div>
                <ul className="max-h-60 space-y-1 overflow-y-auto pr-1">
                  {clients.map((client) => (
                    <li key={client.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`copy-from-${client.id}`}
                        checked={selected.has(client.id)}
                        disabled={busy}
                        onCheckedChange={(checked) => toggle(client.id, checked === true)}
                      />
                      <Label htmlFor={`copy-from-${client.id}`} className="truncate">
                        {client.name}
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Checkbox
                id="copy-from-passwords"
                checked={includePasswords}
                disabled={busy}
                onCheckedChange={(checked) => setIncludePasswords(checked === true)}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="copy-from-passwords">{t('workspaces.copy.includePasswords')}</Label>
                <p className="text-[11px] text-muted">
                  {t('workspaces.copy.passwordsToOrganization')}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted">{t('workspaces.copyFrom.leftOut')}</p>

            <DialogFooter className="mt-1">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                {t('workspaces.add.cancel')}
              </Button>
              <Button type="submit" disabled={busy || selected.size === 0}>
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {busy && progress
                  ? t('workspaces.copyFrom.progress', progress)
                  : t('workspaces.copyFrom.submit', { count: selected.size })}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
