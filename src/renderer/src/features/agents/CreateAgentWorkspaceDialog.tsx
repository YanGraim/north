import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  checkAgentWorkspaceBranchExists,
  pickAgentWorkspaceRepo,
  useCreateAgentWorkspace
} from '@renderer/hooks/use-agent-workspaces'
import { openAgentWorkspaceSession } from '@renderer/stores/sessions-store'
import { FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type CreateAgentWorkspaceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAgentWorkspaceDialog({
  open,
  onOpenChange
}: CreateAgentWorkspaceDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const createWorkspace = useCreateAgentWorkspace()
  const [repoPath, setRepoPath] = useState('')
  const [branch, setBranch] = useState('')
  const [agentCommand, setAgentCommand] = useState('claude')
  const [taskNote, setTaskNote] = useState('')
  const [checkingBranch, setCheckingBranch] = useState(false)
  const [confirmExistingBranch, setConfirmExistingBranch] = useState(false)

  function reset(): void {
    setRepoPath('')
    setBranch('')
    setAgentCommand('claude')
    setTaskNote('')
    setConfirmExistingBranch(false)
  }

  async function handlePickRepo(): Promise<void> {
    const picked = await pickAgentWorkspaceRepo()
    if (picked) setRepoPath(picked)
  }

  async function doCreate(): Promise<void> {
    const workspace = await createWorkspace.mutateAsync({
      repoPath,
      branch,
      agentCommand,
      taskNote: taskNote.trim() ? taskNote.trim() : null,
      columnId: null
    })
    onOpenChange(false)
    reset()
    void openAgentWorkspaceSession(workspace)
  }

  async function handleSubmit(): Promise<void> {
    setCheckingBranch(true)
    const exists = await checkAgentWorkspaceBranchExists(repoPath, branch).finally(() =>
      setCheckingBranch(false)
    )
    if (exists) {
      setConfirmExistingBranch(true)
      return
    }
    await doCreate()
  }

  const canSubmit =
    repoPath.trim().length > 0 && branch.trim().length > 0 && agentCommand.trim().length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        {confirmExistingBranch ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('agents.branchExistsTitle')}</DialogTitle>
              <DialogDescription>
                {t('agents.branchExistsDescription', { branch })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={createWorkspace.isPending}
                onClick={() => setConfirmExistingBranch(false)}
              >
                {t('agents.cancel')}
              </Button>
              <Button
                type="button"
                disabled={createWorkspace.isPending}
                onClick={() => void doCreate()}
              >
                {createWorkspace.isPending ? t('agents.creating') : t('agents.branchExistsConfirm')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('agents.createTitle')}</DialogTitle>
              <DialogDescription>{t('agents.subtitle')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="agent-repo-path">{t('agents.repoPath')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="agent-repo-path"
                    value={repoPath}
                    readOnly
                    placeholder={t('agents.repoPathPlaceholder')}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => void handlePickRepo()}>
                    <FolderOpen className="size-4" />
                    {t('agents.pickRepo')}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-branch">{t('agents.branch')}</Label>
                <Input
                  id="agent-branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder={t('agents.branchPlaceholder')}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-command">{t('agents.agentCommand')}</Label>
                <Input
                  id="agent-command"
                  value={agentCommand}
                  onChange={(event) => setAgentCommand(event.target.value)}
                  placeholder={t('agents.agentCommandPlaceholder')}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-task-note">{t('agents.taskNote')}</Label>
                <Textarea
                  id="agent-task-note"
                  value={taskNote}
                  onChange={(event) => setTaskNote(event.target.value)}
                  placeholder={t('agents.taskNotePlaceholder')}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('agents.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || createWorkspace.isPending || checkingBranch}
                onClick={() => void handleSubmit()}
              >
                {createWorkspace.isPending || checkingBranch
                  ? t('agents.creating')
                  : t('agents.create')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
