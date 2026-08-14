import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { getWhatsNewBody } from '@renderer/content/whats-new'
import { useWhatsNew } from '@renderer/hooks/use-whats-new'
import { useUiStore } from '@renderer/stores/ui-store'
import { Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

type FeatureBlock = {
  title: string
  body: string
}

/** Split changelog markdown into `## Feature` blocks for clearer hierarchy. */
function parseFeatureBlocks(source: string): FeatureBlock[] {
  const trimmed = source.trim()
  if (!trimmed) return []

  const chunks = trimmed.split(/^##\s+/m).filter((chunk) => chunk.trim().length > 0)

  return chunks.map((chunk) => {
    const newline = chunk.indexOf('\n')
    if (newline === -1) {
      return { title: chunk.trim(), body: '' }
    }
    return {
      title: chunk.slice(0, newline).trim(),
      body: chunk.slice(newline + 1).trim()
    }
  })
}

export function WhatsNewDialog(): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const locale = useUiStore((s) => s.locale)
  const { open, entries, dismiss } = useWhatsNew()

  if (entries.length === 0) return null

  const newest = entries[entries.length - 1]
  const oldest = entries[0]
  const multi = entries.length > 1
  const title = multi
    ? t('whatsNew.titleSince', { from: oldest.version, to: newest.version })
    : t('whatsNew.title', { version: newest.version })

  const manualChapter = [...entries].reverse().find((e) => e.chapter)?.chapter

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent className="max-h-[min(80vh,640px)] max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="gap-1 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{t('whatsNew.subtitle')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(50vh,420px)]">
          <div className="space-y-4 px-5 py-4">
            {entries.map((entry) => (
              <div key={entry.version} className="space-y-3">
                {multi ? (
                  <p className="font-mono text-[11px] font-medium tracking-wide text-muted uppercase">
                    v{entry.version}
                  </p>
                ) : null}
                <WhatsNewFeatures source={getWhatsNewBody(entry, locale)} />
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-between">
          {manualChapter ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                dismiss()
                navigate(`/settings/manual?chapter=${manualChapter}`)
              }}
            >
              {t('whatsNew.openManual')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" className="h-8" onClick={() => dismiss()}>
            {t('whatsNew.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WhatsNewFeatures({ source }: { source: string }): React.JSX.Element {
  const { t } = useTranslation()
  const blocks = useMemo(() => parseFeatureBlocks(source), [source])

  if (blocks.length === 0) {
    return <WhatsNewBodyMarkdown source={source} />
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <section
          key={block.title}
          className="rounded-lg border border-border bg-surface-elevated/40 px-3.5 py-3"
        >
          <p className="text-[10px] font-medium tracking-wider text-accent uppercase">
            {t('whatsNew.featureLabel')}
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
            {block.title}
          </h3>
          {block.body ? (
            <div className="mt-2.5">
              <WhatsNewBodyMarkdown source={block.body} />
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

function WhatsNewBodyMarkdown({ source }: { source: string }): React.JSX.Element {
  return (
    <div className="max-w-none min-w-0 overflow-hidden break-words text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          p: ({ children }) => (
            <p className="mb-2.5 text-sm leading-relaxed text-muted last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mt-1 space-y-2 border-l border-border pl-3 text-sm leading-relaxed text-muted">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="relative pl-2 before:absolute before:top-[0.55em] before:left-0 before:size-1 before:rounded-full before:bg-muted before:content-['']">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-medium text-foreground">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
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
