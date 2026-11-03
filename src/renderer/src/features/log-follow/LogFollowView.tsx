import { Button } from '@renderer/components/ui/button'
import { useResolvedTheme } from '@renderer/hooks/use-resolved-theme'
import { resolveMonoFontStack } from '@renderer/lib/mono-font'
import { isAtBottom, writeFollowing } from '@renderer/lib/terminal/follow-output'
import { applyTerminalLigatures } from '@renderer/lib/terminal/ligatures'
import { getXtermTheme } from '@renderer/lib/xterm-theme'
import { useUiStore } from '@renderer/stores/ui-store'
import { coerceBytes } from '@shared/protocols'
import type { LogFollowChunk, LogFollowSnapshot } from '@shared/types'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { AppWindow, ArrowDown, PanelBottom, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type LogFollowViewProps = {
  follow: LogFollowSnapshot
  variant: 'dock' | 'window'
}

/**
 * xterm parks its helper textarea at `left: -9999em` and focuses it on open.
 * `scrollIntoView` then scrolls every ancestor, including the `overflow-hidden`
 * shell, so the whole UI slides off-screen and only the window background remains.
 * Keep the dock's own horizontal scroll; reset everything above it.
 */
function restorePageScroll(from: HTMLElement): void {
  const dock = from.closest('[data-testid="log-follow-dock"]')
  let current = from.parentElement
  while (current) {
    if (current !== dock) {
      current.scrollTop = 0
      current.scrollLeft = 0
    }
    current = current.parentElement
  }
  document.documentElement.scrollTop = 0
  document.documentElement.scrollLeft = 0
  document.body.scrollTop = 0
  document.body.scrollLeft = 0
}

export function LogFollowView({ follow, variant }: LogFollowViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ligaturesRef = useRef<ReturnType<typeof applyTerminalLigatures>>(null)
  const resolvedTheme = useResolvedTheme()
  const themeRef = useRef(resolvedTheme)
  themeRef.current = resolvedTheme
  const monoFontFamily = useUiStore((s) => s.monoFontFamily)
  const monoFontSize = useUiStore((s) => s.monoFontSize)
  const monoLigatures = useUiStore((s) => s.monoLigatures)
  const [pinned, setPinned] = useState(true)
  const title = follow.label?.trim() || follow.path
  const stateLabel = t(`connection.logFollow.states.${follow.state}`)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ui = useUiStore.getState()
    const term = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: resolveMonoFontStack(ui.monoFontFamily, ui.monoLigatures),
      fontSize: ui.monoFontSize,
      lineHeight: 1.2,
      theme: getXtermTheme(themeRef.current),
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    term.blur()
    const pinScroll = (): void => restorePageScroll(container)
    pinScroll()
    requestAnimationFrame(() => {
      pinScroll()
      requestAnimationFrame(pinScroll)
    })
    ligaturesRef.current = applyTerminalLigatures(term, ui.monoLigatures, null)
    termRef.current = term
    fitRef.current = fit
    term.onScroll(() => setPinned(isAtBottom(term)))

    const applyFit = (): void => {
      if (container.clientWidth < 2 || container.clientHeight < 2) return
      try {
        fit.fit()
      } catch {
        return
      }
      if (isAtBottom(term)) term.scrollToBottom()
    }
    applyFit()
    const observer = new ResizeObserver(applyFit)
    observer.observe(container)

    let cancelled = false
    let seen = 0
    let armed = false
    let epoch = 0
    const pending: LogFollowChunk[] = []
    const write = (bytes: Uint8Array): void => {
      writeFollowing(term, bytes)
      setPinned(isAtBottom(term))
    }
    const take = (chunk: LogFollowChunk): void => {
      if (chunk.followId !== follow.id || chunk.seq <= seen) return
      const bytes = coerceBytes(chunk.data)
      if (!bytes) return
      seen = chunk.seq
      write(bytes)
    }

    const unsubscribeData = window.north.logFollows.onData((chunk) => {
      if (chunk.followId !== follow.id) return
      if (!armed) {
        pending.push(chunk)
        return
      }
      take(chunk)
    })
    const unsubscribeReset = window.north.logFollows.onReset((followId) => {
      if (followId !== follow.id) return
      epoch += 1
      term.clear()
      seen = 0
      pending.length = 0
      setPinned(true)
    })

    const ticket = epoch
    void window.north.logFollows.replay(follow.id).then((replay) => {
      if (cancelled || ticket !== epoch) return
      if (replay) {
        const bytes = coerceBytes(replay.data)
        if (bytes && bytes.byteLength > 0) write(bytes)
        seen = replay.seq
      }
      armed = true
      for (const chunk of pending) take(chunk)
      pending.length = 0
    })

    return () => {
      cancelled = true
      unsubscribeData()
      unsubscribeReset()
      observer.disconnect()
      ligaturesRef.current = null
      fitRef.current = null
      try {
        term.dispose()
      } catch {
        // xterm can throw if the canvas is already gone
      }
      termRef.current = null
    }
  }, [follow.id])

  useEffect(() => {
    const term = termRef.current
    const fit = fitRef.current
    const container = containerRef.current
    if (!term || !fit || !container) return
    term.options.fontFamily = resolveMonoFontStack(monoFontFamily, monoLigatures)
    term.options.fontSize = monoFontSize
    ligaturesRef.current = applyTerminalLigatures(term, monoLigatures, ligaturesRef.current)
    requestAnimationFrame(() => {
      if (termRef.current !== term || fitRef.current !== fit) return
      if (container.clientWidth < 2 || container.clientHeight < 2) return
      try {
        fit.fit()
      } catch {
        return
      }
      if (isAtBottom(term)) term.scrollToBottom()
    })
  }, [monoFontFamily, monoFontSize, monoLigatures])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.theme = getXtermTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (follow.focusNonce === 0) return
    const section = sectionRef.current
    const scroller = section?.parentElement
    if (!section || !scroller || scroller.dataset.testid !== 'log-follow-dock') return
    const left = section.offsetLeft
    const right = left + section.offsetWidth
    const viewRight = scroller.scrollLeft + scroller.clientWidth
    if (left < scroller.scrollLeft || right > viewRight) {
      scroller.scrollTo({ left, behavior: 'auto' })
    }
  }, [follow.focusNonce])

  async function popOut(): Promise<void> {
    await window.north.logFollows.popOut(follow.id)
  }

  async function dock(): Promise<void> {
    await window.north.logFollows.dock(follow.id)
  }

  async function close(): Promise<void> {
    await window.north.logFollows.stop(follow.id)
  }

  async function retry(): Promise<void> {
    await window.north.logFollows.retry(follow.id)
  }

  return (
    <section
      ref={sectionRef}
      className="flex h-full min-h-0 min-w-[320px] flex-1 flex-col border-border bg-background"
    >
      <header className="flex items-center gap-2 border-b border-border px-2 py-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{follow.connectionName}</p>
          <p className="truncate font-mono text-[11px] text-muted" title={follow.path}>
            {title}
            <span className="ml-2 font-sans">{stateLabel}</span>
          </p>
        </div>
        {variant === 'dock' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('connection.logFollow.popOut')}
            onClick={() => void popOut()}
          >
            <AppWindow className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('connection.logFollow.dock')}
            onClick={() => void dock()}
          >
            <PanelBottom className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('connection.logFollow.close')}
          onClick={() => void close()}
        >
          <X className="size-3.5" />
        </Button>
      </header>
      {follow.errorCode ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1 text-xs text-destructive">
          <span className="min-w-0 truncate">
            {t(`connection.logFollow.errors.${follow.errorCode}`)}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-6"
            onClick={() => void retry()}
          >
            <RotateCcw className="size-3" />
            {t('connection.logFollow.retry')}
          </Button>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {pinned ? null : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2 h-6"
            onClick={() => {
              termRef.current?.scrollToBottom()
              setPinned(true)
            }}
          >
            <ArrowDown className="size-3" />
            {t('connection.logFollow.jumpToEnd')}
          </Button>
        )}
      </div>
    </section>
  )
}
