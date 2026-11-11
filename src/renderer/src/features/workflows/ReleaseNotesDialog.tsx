import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useClients } from '@renderer/hooks/use-clients'
import { useEnvironment } from '@renderer/hooks/use-environments'
import { canvasToPng, KIND_STYLE, renderReleaseNotes } from '@renderer/lib/release-notes-image'
import { toastError, toastSuccess } from '@renderer/lib/toast'
import {
  draftReleaseNotes,
  type ReleaseNoteKind,
  type ReleaseNoteSection,
  type ReleaseNotes
} from '@shared/lib/release-notes'
import type { EnvironmentUpdate } from '@shared/types'
import { Copy, Download, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

type ReleaseNotesDialogProps = {
  update: EnvironmentUpdate
  open: boolean
  onOpenChange: (open: boolean) => void
}

const VERSION_LIKE = /^v?\d+(\.\d+)+/

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

/** Drafts release notes from an update's commits; the person edits them and exports a PNG. */
export function ReleaseNotesDialog({
  update,
  open,
  onOpenChange
}: ReleaseNotesDialogProps): React.JSX.Element {
  const { data: environment } = useEnvironment(update.environmentId)
  const { data: clients = [] } = useClients()
  const product = clients.find((c) => c.id === environment?.clientId)?.name ?? ''
  const [notes, setNotes] = useState<ReleaseNotes | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // a fresh draft each time the dialog opens, once the client name is known
  useEffect(() => {
    if (!open) {
      setNotes(null)
      return
    }
    if (notes || (environment === undefined && !product)) return
    setNotes(
      draftReleaseNotes(update.commits, {
        product,
        version: update.tag ?? (VERSION_LIKE.test(update.branch) ? update.branch : ''),
        date: longDate(update.finishedAt),
        build: ''
      })
    )
  }, [open, notes, environment, product, update])

  useEffect(() => {
    if (!notes) return
    let url: string | null = null
    let cancelled = false
    const timer = setTimeout(async () => {
      const blob = await canvasToPng(await renderReleaseNotes(notes, 1))
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setPreview(url)
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (url) URL.revokeObjectURL(url)
    }
  }, [notes])

  const patch = (next: Partial<ReleaseNotes>) => setNotes((n) => (n ? { ...n, ...next } : n))
  const patchSection = (index: number, next: Partial<ReleaseNoteSection>) =>
    setNotes((n) =>
      n ? { ...n, sections: n.sections.map((s, i) => (i === index ? { ...s, ...next } : s)) } : n
    )

  async function png(): Promise<Blob | null> {
    if (!notes) return null
    return canvasToPng(await renderReleaseNotes(notes, 2))
  }

  async function copy(): Promise<void> {
    setBusy(true)
    try {
      const blob = await png()
      if (!blob) return
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toastSuccess('Imagem copiada. Cole no WhatsApp, Teams ou e-mail.')
    } catch (error) {
      toastError(error, 'Não deu para copiar a imagem')
    } finally {
      setBusy(false)
    }
  }

  async function save(): Promise<void> {
    setBusy(true)
    try {
      const blob = await png()
      if (!blob || !notes) return
      const name = `${notes.product || 'notas'} ${notes.version}`.trim()
      const result = await window.north.environmentUpdates.saveReleaseNotes(
        new Uint8Array(await blob.arrayBuffer()),
        name
      )
      if (!result.canceled) toastSuccess('Notas da versão salvas')
    } catch (error) {
      toastError(error, 'Não deu para salvar a imagem')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="release-notes-dialog"
        className="flex h-[min(88vh,820px)] max-w-5xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle>Notas da versão</DialogTitle>
          <DialogDescription>
            Rascunho feito a partir dos commits. Ajuste os textos e gere a imagem. Use **assim**
            para negrito.
          </DialogDescription>
        </DialogHeader>
        {notes ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-0 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput
                  label="Produto"
                  value={notes.product}
                  onChange={(product) => patch({ product })}
                />
                <LabeledInput
                  label="Versão"
                  value={notes.version}
                  placeholder="v3.5.040"
                  mono
                  onChange={(version) => patch({ version })}
                />
                <LabeledInput
                  label="Data"
                  value={notes.date}
                  onChange={(date) => patch({ date })}
                />
                <LabeledInput
                  label="Build"
                  value={notes.build}
                  placeholder="opcional"
                  mono
                  onChange={(build) => patch({ build })}
                />
              </div>
              {notes.sections.length === 0 ? (
                <p className="text-xs text-muted">
                  Nenhum commit virou item (merges, chore, docs e testes ficam de fora). Adicione
                  uma seção.
                </p>
              ) : null}
              {notes.sections.map((section, si) => (
                <section
                  key={si}
                  className="space-y-2 rounded-md border border-border p-3"
                  aria-label={`Seção ${section.title || si + 1}`}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) => patchSection(si, { title: e.target.value })}
                      placeholder="Título da seção"
                      aria-label="Título da seção"
                      className="h-8 flex-1 font-medium"
                    />
                    <Input
                      value={section.ticket}
                      onChange={(e) => patchSection(si, { ticket: e.target.value })}
                      placeholder="Chamado"
                      aria-label="Chamado"
                      className="h-8 w-28 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover seção"
                      onClick={() => patch({ sections: notes.sections.filter((_, i) => i !== si) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {section.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <Select
                        value={item.kind}
                        onValueChange={(kind) =>
                          patchSection(si, {
                            items: section.items.map((it, i) =>
                              i === ii ? { ...it, kind: kind as ReleaseNoteKind } : it
                            )
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs" aria-label="Tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(KIND_STYLE) as ReleaseNoteKind[]).map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {KIND_STYLE[kind].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={item.text}
                        onChange={(e) =>
                          patchSection(si, {
                            items: section.items.map((it, i) =>
                              i === ii ? { ...it, text: e.target.value } : it
                            )
                          })
                        }
                        aria-label="Texto do item"
                        className="h-8 flex-1 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover item"
                        onClick={() =>
                          patchSection(si, { items: section.items.filter((_, i) => i !== ii) })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      patchSection(si, { items: [...section.items, { kind: 'new', text: '' }] })
                    }
                  >
                    <Plus className="size-3.5" /> Item
                  </Button>
                </section>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  patch({
                    sections: [...notes.sections, { title: '', ticket: '', items: [] }]
                  })
                }
              >
                <Plus className="size-4" /> Seção
              </Button>
            </div>
            <div className="flex min-h-0 flex-col border-l border-border bg-background">
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {preview ? (
                  <img
                    src={preview}
                    alt="Prévia das notas da versão"
                    className="w-full rounded-md border border-border"
                  />
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2 border-t border-border p-3">
                <Button variant="outline" className="flex-1" disabled={busy} onClick={copy}>
                  <Copy className="size-4" /> Copiar imagem
                </Button>
                <Button className="flex-1" disabled={busy} onClick={save}>
                  <Download className="size-4" /> Salvar PNG
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  mono
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
}): React.JSX.Element {
  const id = useId()
  return (
    <div className="space-y-1 text-xs text-muted">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? 'h-8 font-mono text-xs' : 'h-8 text-xs'}
      />
    </div>
  )
}
