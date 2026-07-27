import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useCreateTag, useTags } from '@renderer/hooks/use-tags'
import { cn } from '@renderer/lib/utils'
import type { Tag } from '@shared/types'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

type TagInputProps = {
  value: string[]
  onChange: (tagIds: string[]) => void
  disabled?: boolean
}

export function TagInput({ value, onChange, disabled }: TagInputProps): React.JSX.Element {
  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => tags.filter((tag) => value.includes(tag.id)), [tags, value])

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tags
      .filter((tag) => !value.includes(tag.id))
      .filter((tag) => (q ? tag.name.toLowerCase().includes(q) : true))
  }, [tags, value, query])

  const canCreate =
    query.trim().length > 0 &&
    !tags.some((tag) => tag.name.toLowerCase() === query.trim().toLowerCase())

  async function handleCreate(): Promise<void> {
    const name = query.trim()
    if (!name) return
    const tag = await createTag.mutateAsync({ name })
    onChange([...value, tag.id])
    setQuery('')
    setOpen(false)
  }

  function toggle(tag: Tag): void {
    if (value.includes(tag.id)) {
      onChange(value.filter((id) => id !== tag.id))
    } else {
      onChange([...value, tag.id])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 ? (
          <span className="text-xs text-muted">Nenhuma tag</span>
        ) : (
          selected.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              <span
                className="size-1.5 rounded-full"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              />
              {tag.name}
              <button
                type="button"
                className="rounded-sm p-0.5 text-muted hover:text-foreground"
                aria-label={`Remover ${tag.name}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((id) => id !== tag.id))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-8">
            <Plus className="size-3.5" />
            Adicionar tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2 p-2" align="start">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ou criar…"
            className="h-8"
            autoFocus
          />
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface'
                )}
                onClick={() => {
                  toggle(tag)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span
                  className="size-2 rounded-full bg-muted"
                  style={tag.color ? { backgroundColor: tag.color } : undefined}
                />
                {tag.name}
              </button>
            ))}
            {available.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-xs text-muted">Nenhuma tag disponível</p>
            ) : null}
          </div>
          {canCreate ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-full"
              disabled={createTag.isPending}
              onClick={() => void handleCreate()}
            >
              <Plus className="size-3.5" />
              Criar “{query.trim()}”
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
