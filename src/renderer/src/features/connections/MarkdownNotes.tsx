import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/lib/utils'
import { Eye, EyeOff, Pencil } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownNotesProps = {
  notes: string | null
  className?: string
  /** When provided, enables edit mode with save callback. */
  onSave?: (notes: string | null) => Promise<void> | void
}

export function MarkdownNotes({ notes, className, onSave }: MarkdownNotesProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const content = notes?.trim() ? notes : null

  async function handleSave(): Promise<void> {
    if (!onSave) return
    setSaving(true)
    try {
      const next = draft.trim() ? draft : null
      await onSave(next)
      setEditing(false)
      setPreview(false)
    } finally {
      setSaving(false)
    }
  }

  function startEditing(): void {
    setDraft(notes ?? '')
    setPreview(false)
    setEditing(true)
  }

  function cancelEditing(): void {
    setDraft(notes ?? '')
    setPreview(false)
    setEditing(false)
  }

  if (editing && onSave) {
    return (
      <div className={cn('min-w-0 space-y-2', className)}>
        {preview ? (
          <div className="min-h-36 min-w-0 rounded-md border border-border bg-surface-elevated px-3 py-2">
            {draft.trim() ? (
              <MarkdownBody source={draft} />
            ) : (
              <p className="text-xs text-muted">Nada para pré-visualizar.</p>
            )}
          </div>
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="min-h-36 w-full min-w-0 resize-y font-mono text-xs"
            placeholder="Escreva em Markdown…"
          />
        )}

        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs text-muted"
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {preview ? 'Editar' : 'Preview'}
          </Button>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              disabled={saving}
              onClick={cancelEditing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className={cn('min-w-0', className)}>
        {onSave ? (
          <button
            type="button"
            onClick={startEditing}
            className="flex w-full min-w-0 items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-left text-[13px] text-muted transition-colors hover:border-border hover:bg-surface-elevated/40 hover:text-foreground"
          >
            <Pencil className="size-3.5 shrink-0" />
            Adicionar notas
          </button>
        ) : (
          <p className="text-sm text-muted">Sem notas</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <MarkdownBody source={content} />
      {onSave ? (
        <button
          type="button"
          onClick={startEditing}
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <Pencil className="size-3" />
          Editar
        </button>
      ) : null}
    </div>
  )
}

function MarkdownBody({ source }: { source: string }): React.JSX.Element {
  return (
    <div className="prose prose-invert prose-sm max-w-none min-w-0 overflow-hidden break-words text-sm text-foreground [&_a]:text-accent [&_code]:rounded [&_code]:bg-surface-elevated [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:bg-surface-elevated [&_ul]:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
