import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  getManualChapters,
  isManualChapterId,
  type ManualChapterId
} from '@renderer/content/manual'
import { cn } from '@renderer/lib/utils'
import { useUiStore } from '@renderer/stores/ui-store'
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useSearchParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'

export function ManualPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = useUiStore((s) => s.locale)

  const chapters = useMemo(() => getManualChapters(locale), [locale])
  const chapterParam = searchParams.get('chapter')
  const activeId: ManualChapterId =
    chapterParam && isManualChapterId(chapterParam) ? chapterParam : chapters[0].id

  const activeIndex = chapters.findIndex((chapter) => chapter.id === activeId)
  const active = chapters[activeIndex] ?? chapters[0]
  const prev = activeIndex > 0 ? chapters[activeIndex - 1] : null
  const next = activeIndex < chapters.length - 1 ? chapters[activeIndex + 1] : null

  useEffect(() => {
    if (!chapterParam || !isManualChapterId(chapterParam)) {
      setSearchParams({ chapter: chapters[0].id }, { replace: true })
    }
  }, [chapterParam, chapters, setSearchParams])

  function goTo(id: ManualChapterId): void {
    setSearchParams({ chapter: id })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted"
          onClick={() => navigate('/settings')}
        >
          <ArrowLeft className="size-3.5" />
          {t('help.backToSettings')}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-3.5 text-muted" />
            <h1 className="text-sm font-medium text-foreground">{t('help.title')}</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted">{t('help.subtitle')}</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border md:flex md:flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <nav className="flex flex-col gap-0.5 p-2" aria-label={t('help.toc')}>
              {chapters.map((chapter, index) => {
                const selected = chapter.id === active.id
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => goTo(chapter.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                      selected
                        ? 'bg-surface-elevated font-medium text-foreground'
                        : 'text-muted hover:bg-surface-elevated/60 hover:text-foreground'
                    )}
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-muted/80">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {t(chapter.titleKey)}
                  </button>
                )
              })}
            </nav>
          </ScrollArea>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <article className="mx-auto max-w-2xl px-4 py-6 md:px-8">
              <p className="mb-3 text-[11px] font-medium tracking-wide text-muted uppercase md:hidden">
                {t(active.titleKey)}
              </p>
              <ManualMarkdown source={active.body} />
            </article>
          </ScrollArea>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            {prev ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => goTo(prev.id)}
              >
                <ChevronLeft className="size-3.5" />
                <span className="max-w-40 truncate">{t(prev.titleKey)}</span>
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => goTo(next.id)}
              >
                <span className="max-w-40 truncate">{t(next.titleKey)}</span>
                <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => navigate('/settings')}
              >
                {t('help.done')}
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ManualMarkdown({ source }: { source: string }): React.JSX.Element {
  return (
    <div className="prose prose-invert prose-sm max-w-none min-w-0 overflow-hidden break-words text-sm text-foreground [&_a]:text-accent [&_code]:rounded [&_code]:bg-surface-elevated [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-medium [&_li]:my-0.5 [&_p]:my-2 [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:bg-surface-elevated [&_table]:my-3 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2">
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
