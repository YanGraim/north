import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { ApiSendResult } from '@shared/protocols'
import { ChevronDown, ChevronUp, Copy, Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { JsonEditor } from './JsonEditor'

type ResponseViewerProps = {
  response: ApiSendResult | null
  error: string | null
  sending: boolean
}

function prettyJson(raw: string): string | null {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return null
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

const KNOWN_ERROR_KINDS = ['invalid-url', 'dns', 'tls', 'timeout', 'network', 'aborted'] as const

function statusVariant(status: number | null): 'default' | 'secondary' | 'outline' {
  if (status == null) return 'outline'
  if (status >= 200 && status < 300) return 'default'
  if (status >= 400) return 'secondary'
  return 'outline'
}

export function ResponseViewer({
  response,
  error,
  sending
}: ResponseViewerProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pretty, setPretty] = useState(true)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [errorOpen, setErrorOpen] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const findIndexRef = useRef(0)

  useEffect(() => {
    if (!sending) {
      setElapsedMs(0)
      return
    }
    const started = Date.now()
    setElapsedMs(0)
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started)
    }, 100)
    return () => window.clearInterval(timer)
  }, [sending])

  const errorKind = response?.errorKind
  const displayError =
    errorKind && (KNOWN_ERROR_KINDS as readonly string[]).includes(errorKind)
      ? t(`api.errors.${errorKind}`)
      : (error ?? response?.errorMessage ?? null)

  const body = useMemo(() => {
    if (!response) return ''
    if (!pretty) return response.bodyText
    return prettyJson(response.bodyText) ?? response.bodyText
  }, [pretty, response])

  function copyBody(): void {
    if (!response) return
    void navigator.clipboard.writeText(pretty ? body : response.bodyText)
  }

  function runFind(direction: 'next' | 'prev'): void {
    if (!findQuery || !body) return
    const hay = body.toLowerCase()
    const needle = findQuery.toLowerCase()
    const from = findIndexRef.current
    let index =
      direction === 'next' ? hay.indexOf(needle, from + 1) : hay.lastIndexOf(needle, from - 1)
    if (index < 0) {
      index = direction === 'next' ? hay.indexOf(needle) : hay.lastIndexOf(needle)
    }
    findIndexRef.current = index
  }

  if (!response && !error && !sending) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('api.studio.emptyResponse')}
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {sending ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-background/70">
          <Loader2 className="size-5 animate-spin text-muted" />
          <p className="text-xs text-muted">{t('api.studio.sending')}</p>
          <p className="font-mono text-[11px] text-muted">{formatElapsed(elapsedMs)}</p>
        </div>
      ) : null}
      <div className={cn('flex h-full min-h-0 flex-col', sending && 'opacity-40')}>
        {response ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
            <Badge variant={statusVariant(response.status)} data-testid="api-status">
              {response.status ?? '—'} {response.statusText}
            </Badge>
            <span className="text-[11px] text-muted">
              {Math.round(response.durationMs)} ms · {response.sizeBytes} B
              {response.truncated ? ` · ${t('api.studio.truncated')}` : ''}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPretty(true)}
                disabled={pretty}
              >
                {t('api.studio.pretty')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setPretty(false)}
                disabled={!pretty}
              >
                {t('api.studio.raw')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t('api.studio.find')}
                onClick={() => setFindOpen(true)}
              >
                <Search className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t('api.studio.copy')}
                onClick={copyBody}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {displayError ? (
          <div className="shrink-0 border-b border-border px-2 py-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-1 text-left text-xs text-red-400"
              onClick={() => setErrorOpen((open) => !open)}
            >
              {errorOpen ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
              {t('api.errors.title')}
            </button>
            {errorOpen ? <p className="mt-1 text-xs text-muted">{displayError}</p> : null}
          </div>
        ) : null}

        {response ? (
          <div className="min-h-0 flex-1">
            <JsonEditor value={body} readOnly fold />
          </div>
        ) : null}

        {findOpen ? (
          <search
            className={cn(
              'absolute top-10 right-2 z-20 flex items-center gap-1 rounded-md border border-border bg-surface-elevated p-1 shadow-md'
            )}
          >
            <Input
              value={findQuery}
              onChange={(event) => {
                setFindQuery(event.target.value)
                findIndexRef.current = -1
                runFind('next')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  runFind(event.shiftKey ? 'prev' : 'next')
                }
                if (event.key === 'Escape') setFindOpen(false)
              }}
              placeholder={t('api.studio.find')}
              className="h-7 w-40 text-xs"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => runFind('prev')}
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => runFind('next')}
            >
              <ChevronDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setFindOpen(false)}
            >
              <X className="size-3.5" />
            </Button>
          </search>
        ) : null}
      </div>
    </div>
  )
}
