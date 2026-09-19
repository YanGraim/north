import { ConfirmDeleteDialog } from '@renderer/components/ConfirmDeleteDialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { AgentWorkspaceCard } from '@renderer/features/agents/AgentWorkspaceCard'
import { CreateAgentWorkspaceDialog } from '@renderer/features/agents/CreateAgentWorkspaceDialog'
import {
  useAgentBoardColumns,
  useCreateAgentBoardColumn,
  useDeleteAgentBoardColumn,
  useUpdateAgentBoardColumn
} from '@renderer/hooks/use-agent-board-columns'
import { useAgentWorkspaces, useUpdateAgentWorkspace } from '@renderer/hooks/use-agent-workspaces'
import { cn } from '@renderer/lib/utils'
import type { AgentBoardColumn, AgentWorkspace } from '@shared/types'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NO_COLUMN = '__no_column__'

function Column({
  column,
  workspaces,
  draggingId,
  onCardDragStart,
  onDropWorkspace
}: {
  column: AgentBoardColumn | null
  workspaces: AgentWorkspace[]
  draggingId: string | null
  onCardDragStart: (id: string) => void
  onDropWorkspace: (id: string, columnId: string | null) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [dragOver, setDragOver] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(column?.name ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateColumn = useUpdateAgentBoardColumn()
  const deleteColumn = useDeleteAgentBoardColumn()

  function saveRename(): void {
    const trimmed = name.trim()
    if (column && trimmed && trimmed !== column.name) {
      updateColumn.mutate({ id: column.id, input: { name: trimmed } })
    }
    setRenaming(false)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop Kanban column, not a semantic list itself
    <div
      className={cn(
        'flex min-h-0 min-w-[280px] flex-1 flex-col gap-2 rounded-lg border border-border bg-surface/40 p-3',
        dragOver && 'ring-1 ring-inset ring-accent'
      )}
      onDragOver={(event) => {
        if (!draggingId) return
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        const id = event.dataTransfer.getData('text/plain')
        if (id) onDropWorkspace(id, column?.id ?? null)
      }}
    >
      <div className="group flex items-center justify-between gap-1 px-1">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveRename()
                if (event.key === 'Escape') setRenaming(false)
              }}
              className="h-6 text-xs"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={saveRename}
            >
              <Check className="size-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={() => setRenaming(false)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 truncate">
              {column ? (
                <button
                  type="button"
                  className="truncate text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
                  onClick={() => {
                    setName(column.name)
                    setRenaming(true)
                  }}
                >
                  {column.name}
                </button>
              ) : (
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                  {t('agents.noColumn')}
                </span>
              )}
            </h2>
            <span className="shrink-0 text-xs text-muted">{workspaces.length}</span>
            {column ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3" />
              </Button>
            ) : null}
          </>
        )}
      </div>
      <ul className="flex min-h-[80px] flex-col gap-2 overflow-y-auto">
        {workspaces.map((workspace) => (
          <AgentWorkspaceCard
            key={workspace.id}
            workspace={workspace}
            onDragStart={onCardDragStart}
          />
        ))}
      </ul>

      {column ? (
        <ConfirmDeleteDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('agents.deleteColumnConfirmTitle')}
          description={t('agents.deleteColumnConfirmDescription')}
          confirming={deleteColumn.isPending}
          onConfirm={async () => {
            await deleteColumn.mutateAsync({ id: column.id })
            setConfirmDelete(false)
          }}
        />
      ) : null}
    </div>
  )
}

function AddColumnButton(): React.JSX.Element {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const createColumn = useCreateAgentBoardColumn()

  function submit(): void {
    const trimmed = name.trim()
    if (trimmed) createColumn.mutate({ name: trimmed })
    setName('')
    setAdding(false)
  }

  if (!adding) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-9 min-w-[200px] shrink-0 self-start"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-4" />
        {t('agents.newColumn')}
      </Button>
    )
  }

  return (
    <div className="flex min-w-[220px] shrink-0 items-center gap-1 self-start">
      <Input
        autoFocus
        value={name}
        placeholder={t('agents.newColumnPlaceholder')}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') setAdding(false)
        }}
        className="h-9"
      />
      <Button type="button" size="icon" variant="ghost" onClick={submit}>
        <Check className="size-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={() => setAdding(false)}>
        <X className="size-4" />
      </Button>
    </div>
  )
}

export function AgentsBoard(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: workspaces = [], isLoading: workspacesLoading } = useAgentWorkspaces()
  const { data: columns = [], isLoading: columnsLoading } = useAgentBoardColumns()
  const updateWorkspace = useUpdateAgentWorkspace()
  const [createOpen, setCreateOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const isLoading = workspacesLoading || columnsLoading

  const byColumn = useMemo(() => {
    const map = new Map<string, AgentWorkspace[]>()
    for (const workspace of workspaces) {
      const key = workspace.columnId ?? NO_COLUMN
      const list = map.get(key) ?? []
      list.push(workspace)
      map.set(key, list)
    }
    return map
  }, [workspaces])

  const orphaned = byColumn.get(NO_COLUMN) ?? []

  function handleDrop(id: string, columnId: string | null): void {
    const workspace = workspaces.find((w) => w.id === id)
    if (!workspace || workspace.columnId === columnId) return
    updateWorkspace.mutate({ id, input: { columnId } })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-medium text-foreground">{t('agents.title')}</h1>
          <p className="mt-0.5 text-xs text-muted">{t('agents.subtitle')}</p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('agents.newWorkspace')}
        </Button>
      </div>

      {isLoading ? null : (
        // biome-ignore lint/a11y/noStaticElementInteractions: drag-end tracking for the whole board
        <div
          className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4"
          onDragEnd={() => setDraggingId(null)}
        >
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              workspaces={byColumn.get(column.id) ?? []}
              draggingId={draggingId}
              onCardDragStart={setDraggingId}
              onDropWorkspace={handleDrop}
            />
          ))}
          {orphaned.length > 0 ? (
            <Column
              column={null}
              workspaces={orphaned}
              draggingId={draggingId}
              onCardDragStart={setDraggingId}
              onDropWorkspace={handleDrop}
            />
          ) : null}
          <AddColumnButton />
        </div>
      )}

      <CreateAgentWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
