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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useCurrentWorkspace, useWorkspaces } from '@renderer/hooks/use-workspaces'
import { formatIpcError } from '@renderer/lib/ipc-error'
import { workspacePath } from '@renderer/lib/workspace-paths'
import { useCopyToWorkspaceStore } from '@renderer/stores/copy-to-workspace-store'
import type { CopyTargetTree, CopyToWorkspaceReport } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { invalidateWorkspaceCache } from './WorkspaceScope'

type Destination = { id: string; label: string; clientId: string }

/** Where each kind lands: a client needs nothing, the rest need their parent in the target. */
function destinations(kind: string, tree: CopyTargetTree | undefined): Destination[] {
  if (!tree) return []
  const clientName = new Map(tree.clients.map((c) => [c.id, c.name]))
  const envById = new Map(tree.environments.map((e) => [e.id, e]))
  if (kind === 'environment') {
    return tree.clients.map((c) => ({ id: c.id, label: c.name, clientId: c.id }))
  }
  if (kind === 'group') {
    return tree.environments.map((e) => ({
      id: e.id,
      label: `${clientName.get(e.clientId) ?? '?'} › ${e.name}`,
      clientId: e.clientId
    }))
  }
  if (kind === 'connection') {
    return tree.groups.map((g) => {
      const env = envById.get(g.environmentId)
      return {
        id: g.id,
        label: `${clientName.get(env?.clientId ?? '') ?? '?'} › ${env?.name ?? '?'} › ${g.name}`,
        clientId: env?.clientId ?? ''
      }
    })
  }
  return []
}

/**
 * "Copiar para workspace…" (ADR 0018 §4): a new, unlinked copy of a client,
 * environment, group or connection in another workspace. Main reads the
 * source, re-encrypts passwords in the target and reports what was left out.
 */
export function CopyToWorkspaceDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const subject = useCopyToWorkspaceStore((s) => s.subject)
  const close = useCopyToWorkspaceStore((s) => s.close)
  const current = useCurrentWorkspace()
  const { data: workspaces = [] } = useWorkspaces()
  const others = workspaces.filter((w) => w.id !== current?.id)

  const [targetId, setTargetId] = useState<string>('')
  const [parentId, setParentId] = useState<string>('')
  const [includePasswords, setIncludePasswords] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<CopyToWorkspaceReport | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when opened on a new subject
  useEffect(() => {
    if (!subject) return
    setTargetId(others.length === 1 ? others[0].id : '')
    setParentId('')
    setIncludePasswords(true)
    setError(null)
    setReport(null)
  }, [subject])

  const needsParent = subject !== null && subject.kind !== 'client'
  const targets = useQuery({
    queryKey: ['workspaces', 'copy-targets', targetId],
    queryFn: () => window.north.workspaces.copyTargets(targetId),
    enabled: Boolean(subject && targetId && needsParent),
    retry: false,
    staleTime: 0
  })
  const options = useMemo(
    () => destinations(subject?.kind ?? 'client', targets.data),
    [subject?.kind, targets.data]
  )

  if (!subject) return null
  const target = others.find((w) => w.id === targetId) ?? null
  const ready = Boolean(target) && (!needsParent || Boolean(parentId)) && !busy

  const copy = async (): Promise<void> => {
    if (!ready || !target) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.north.workspaces.copy({
        kind: subject.kind,
        id: subject.id,
        targetWorkspaceId: target.id,
        targetParentId: needsParent ? parentId : null,
        includePasswords
      })
      invalidateWorkspaceCache(target.id)
      setReport(result)
    } catch (e) {
      setError(formatIpcError(e, t('workspaces.copy.failed')))
    } finally {
      setBusy(false)
    }
  }

  const openCopy = (): void => {
    if (!report || !target) return
    const clientId =
      subject.kind === 'client'
        ? report.root.id
        : (options.find((o) => o.id === parentId)?.clientId ?? '')
    const path =
      report.root.kind === 'client'
        ? `/clients/${report.root.id}`
        : report.root.kind === 'environment'
          ? `/clients/${clientId}?env=${report.root.id}`
          : report.root.kind === 'group'
            ? `/clients/${clientId}?group=${report.root.id}`
            : `/connections?connection=${report.root.id}`
    close()
    void navigate(workspacePath(target.id, path))
  }

  const passwordHint =
    current?.kind === 'organization'
      ? t('workspaces.copy.passwordsFromOrganization')
      : target?.kind === 'organization'
        ? t('workspaces.copy.passwordsToOrganization')
        : t('workspaces.copy.passwordsToLocal')

  const summary = report
    ? [
        report.created.clients && t('workspaces.copy.clients', { count: report.created.clients }),
        report.created.environments &&
          t('workspaces.copy.environments', { count: report.created.environments }),
        report.created.groups && t('workspaces.copy.groups', { count: report.created.groups }),
        t('workspaces.copy.connections', { count: report.created.connections }),
        report.passwordsCopied && t('workspaces.copy.passwords', { count: report.passwordsCopied })
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-md" data-testid="copy-to-workspace">
        <DialogHeader>
          <DialogTitle>{t('workspaces.copy.title', { name: subject.name })}</DialogTitle>
          <DialogDescription>{t('workspaces.copy.description')}</DialogDescription>
        </DialogHeader>

        {report ? (
          <div className="flex flex-col gap-2" data-testid="copy-report">
            <p className="text-sm text-foreground">
              {t('workspaces.copy.done', { workspace: target?.name ?? '' })}
            </p>
            <p className="font-mono text-xs text-muted">{summary}</p>
            {report.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-4 text-xs text-amber-400">
                {report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={close}>
                {t('workspaces.copy.close')}
              </Button>
              <Button type="button" onClick={openCopy}>
                {t('workspaces.copy.open', { workspace: target?.name ?? '' })}
              </Button>
            </DialogFooter>
          </div>
        ) : others.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t('workspaces.copy.noOther')}</p>
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={close}>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="copy-target">{t('workspaces.copy.target')}</Label>
              <Select
                value={targetId}
                onValueChange={(value) => {
                  setTargetId(value)
                  setParentId('')
                }}
              >
                <SelectTrigger id="copy-target" aria-label={t('workspaces.copy.target')}>
                  <SelectValue placeholder={t('workspaces.copy.pickWorkspace')} />
                </SelectTrigger>
                <SelectContent>
                  {others.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.kind === 'local' ? t('workspaces.personal') : w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsParent && target ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="copy-parent">{t(`workspaces.copy.parent.${subject.kind}`)}</Label>
                {targets.isError ? (
                  <p role="alert" className="text-xs text-red-400">
                    {formatIpcError(targets.error, t('workspaces.copy.failed'))}
                  </p>
                ) : targets.isLoading ? (
                  <Loader2 className="size-4 animate-spin text-muted" aria-hidden />
                ) : options.length === 0 ? (
                  <p className="text-xs text-muted">{t(`workspaces.copy.empty.${subject.kind}`)}</p>
                ) : (
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger
                      id="copy-parent"
                      aria-label={t(`workspaces.copy.parent.${subject.kind}`)}
                    >
                      <SelectValue placeholder={t('workspaces.copy.pickParent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}

            <div className="flex items-start gap-2">
              <Checkbox
                id="copy-passwords"
                checked={includePasswords}
                onCheckedChange={(checked) => setIncludePasswords(checked === true)}
              />
              <div className="grid gap-0.5">
                <Label htmlFor="copy-passwords">{t('workspaces.copy.includePasswords')}</Label>
                <p className="text-[11px] text-muted">{passwordHint}</p>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            ) : null}

            <DialogFooter className="mt-1">
              <Button type="button" variant="ghost" onClick={close}>
                {t('workspaces.add.cancel')}
              </Button>
              <Button type="submit" disabled={!ready}>
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {t('workspaces.copy.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
