import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { SearchAddon } from '@xterm/addon-search'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type TerminalFindBarProps = {
  open: boolean
  searchAddon: SearchAddon | null
  onClose: () => void
  className?: string
}

export function TerminalFindBar({
  open,
  searchAddon,
  onClose,
  className
}: TerminalFindBarProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [resultIndex, setResultIndex] = useState(-1)
  const [resultCount, setResultCount] = useState(0)

  useEffect(() => {
    if (!open) {
      searchAddon?.clearDecorations()
      return
    }
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [open, searchAddon])

  useEffect(() => {
    if (!searchAddon || !open) return
    const disposable = searchAddon.onDidChangeResults((event) => {
      setResultIndex(event.resultIndex)
      setResultCount(event.resultCount)
    })
    return () => disposable.dispose()
  }, [searchAddon, open])

  if (!open) return null

  const runFind = (direction: 'next' | 'prev', term = query): void => {
    if (!searchAddon || !term) {
      setResultIndex(-1)
      setResultCount(0)
      return
    }
    const options = {
      caseSensitive: false,
      incremental: direction === 'next',
      decorations: {
        matchBackground: '#3b82f666',
        matchOverviewRuler: '#3b82f6',
        activeMatchBackground: '#f59e0b99',
        activeMatchColorOverviewRuler: '#f59e0b'
      }
    }
    if (direction === 'next') searchAddon.findNext(term, options)
    else searchAddon.findPrevious(term, options)
  }

  return (
    <search
      className={cn(
        'absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md border border-border bg-surface-elevated p-1 shadow-md',
        className
      )}
    >
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          runFind('next', next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            runFind(event.shiftKey ? 'prev' : 'next')
          }
        }}
        placeholder="Buscar…"
        className="h-7 w-44 border-0 bg-transparent shadow-none focus-visible:ring-0"
        aria-label="Buscar no terminal"
      />
      <span className="min-w-12 px-1 text-center font-mono text-[11px] text-muted tabular-nums">
        {query && resultCount > 0 ? `${resultIndex + 1}/${resultCount}` : query ? '0/0' : ''}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Ocorrência anterior"
        onClick={() => runFind('prev')}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Próxima ocorrência"
        onClick={() => runFind('next')}
      >
        <ChevronDown className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Fechar busca"
        onClick={onClose}
      >
        <X className="size-3.5" />
      </Button>
    </search>
  )
}
