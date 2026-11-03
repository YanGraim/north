import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ENTITY_COLORS, type EntityColor } from '@renderer/lib/entity-colors'
import { normalizeHexColor } from '@renderer/lib/favorite-colors'
import { cn } from '@renderer/lib/utils'
import { useUiStore } from '@renderer/stores/ui-store'
import { Check, Pipette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Opens the native dialog when the entity has no valid color. Confirming it still writes. */
const NATIVE_PICKER_EMPTY_COLOR = '#64748b' satisfies EntityColor

type ColorPickerProps = {
  value: string | null | undefined
  onChange: (color: string | null) => void
  disabled?: boolean
}

type SwatchProps = {
  color: string
  selected: boolean
  label: string
  onSelect: () => void
  onRemove?: () => void
}

function eventTargetsPipette(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-color-picker-pipette]') !== null
}

function isInsidePicker(target: EventTarget | null, content: HTMLElement | null): boolean {
  if (!(target instanceof Node)) return false
  if (content?.contains(target)) return true
  return eventTargetsPipette(target)
}

function ColorSwatch({
  color,
  selected,
  label,
  onSelect,
  onRemove
}: SwatchProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex size-7 cursor-pointer items-center justify-center rounded-md border border-border transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'ring-2 ring-ring'
      )}
      style={{ backgroundColor: color }}
      onClick={(event) => {
        // Ctrl+click is the macOS context menu; it must not apply the color.
        if (event.ctrlKey) return
        onSelect()
      }}
      onContextMenu={
        onRemove
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove()
            }
          : undefined
      }
      onKeyDown={
        onRemove
          ? (event) => {
              if (event.key !== 'Delete' && event.key !== 'Backspace') return
              event.preventDefault()
              onRemove()
            }
          : undefined
      }
    >
      {selected ? <Check className="size-3.5 text-accent-foreground" aria-hidden /> : null}
    </button>
  )
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  const favoriteColors = useUiStore((state) => state.favoriteColors)
  const rememberFavorite = useUiStore((state) => state.rememberFavoriteColor)
  const removeFavorite = useUiStore((state) => state.removeFavoriteColor)
  const [open, setOpen] = useState(false)
  const normalizedValue = value ? normalizeHexColor(value) : null
  const [hexDraft, setHexDraft] = useState(normalizedValue ?? '')
  const colorInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const skipBlurRef = useRef(false)
  const pipettePointerRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const rememberRef = useRef(rememberFavorite)
  const disabledRef = useRef(Boolean(disabled))
  onChangeRef.current = onChange
  rememberRef.current = rememberFavorite
  disabledRef.current = Boolean(disabled)

  useEffect(() => {
    const input = colorInputRef.current
    if (!input) return
    // Native `change` only. React's onChange is `input`, which Windows fires while dragging.
    const handleChange = (): void => {
      if (disabledRef.current) return
      const normalized = normalizeHexColor(input.value)
      if (!normalized) return
      onChangeRef.current(normalized)
      rememberRef.current(normalized)
      setHexDraft(normalized)
    }
    input.addEventListener('change', handleChange)
    return () => input.removeEventListener('change', handleChange)
  }, [])

  function closeWith(color: string | null, remember: boolean): void {
    skipBlurRef.current = true
    onChange(color)
    if (remember && color) rememberFavorite(color)
    setOpen(false)
  }

  function commitHexDraft(): void {
    const normalized = normalizeHexColor(hexDraft)
    if (!normalized) {
      setHexDraft(normalizedValue ?? '')
      return
    }
    closeWith(normalized, true)
  }

  function handleHexBlur(event: React.FocusEvent<HTMLInputElement>): void {
    const fromPipette = pipettePointerRef.current
    pipettePointerRef.current = false
    if (skipBlurRef.current) return
    if (fromPipette || isInsidePicker(event.relatedTarget, contentRef.current)) {
      if (normalizeHexColor(hexDraft) === null) setHexDraft(normalizedValue ?? '')
      return
    }
    const normalized = normalizeHexColor(hexDraft)
    if (!normalized) {
      skipBlurRef.current = true
      setHexDraft(normalizedValue ?? '')
      return
    }
    closeWith(normalized, true)
  }

  function openNativePicker(): void {
    if (disabled) return
    const input = colorInputRef.current
    if (!input) return
    pipettePointerRef.current = true
    input.value = normalizedValue ?? NATIVE_PICKER_EMPTY_COLOR
    input.click()
    pipettePointerRef.current = false
  }

  function keepPipetteOpen(event: {
    preventDefault: () => void
    target: EventTarget | null
  }): void {
    if (eventTargetsPipette(event.target)) event.preventDefault()
  }

  const favorites = favoriteColors.flatMap((color) => {
    const safe = normalizeHexColor(color)
    return safe ? [safe] : []
  })

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        modal={false}
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (disabled) return
          if (next) {
            skipBlurRef.current = false
            setHexDraft(normalizedValue ?? '')
          }
          setOpen(next)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-9 min-w-[10rem] justify-start gap-3 px-3"
            aria-label={t('colorPicker.choose')}
          >
            <span
              className={cn(
                'size-4 shrink-0 rounded-full border',
                normalizedValue ? 'border-transparent' : 'border-dashed border-muted'
              )}
              style={normalizedValue ? { backgroundColor: normalizedValue } : undefined}
              aria-hidden
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left text-xs',
                normalizedValue ? 'text-foreground' : 'text-muted'
              )}
            >
              {normalizedValue ?? t('colorPicker.none')}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[110] w-auto p-2"
          align="start"
          onInteractOutside={keepPipetteOpen}
          onFocusOutside={keepPipetteOpen}
          onMouseDown={(event) => {
            const target = event.target
            if (target instanceof Element && target.closest('input')) return
            event.preventDefault()
          }}
        >
          <div ref={contentRef} className="flex flex-col gap-2">
            <Input
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value)}
              onFocus={() => {
                skipBlurRef.current = false
              }}
              onBlur={handleHexBlur}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  skipBlurRef.current = true
                  setHexDraft(normalizedValue ?? '')
                  return
                }
                if (event.key !== 'Enter') return
                event.preventDefault()
                commitHexDraft()
              }}
              aria-label={t('colorPicker.hex')}
              placeholder={t('colorPicker.hexPlaceholder')}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              className="h-8 px-2 text-xs"
            />
            <div className="grid grid-cols-5 gap-1.5">
              {ENTITY_COLORS.map((color) => (
                <ColorSwatch
                  key={color}
                  color={color}
                  selected={normalizedValue === color}
                  label={t('colorPicker.swatch', { color })}
                  onSelect={() => closeWith(color, false)}
                />
              ))}
            </div>
            {favorites.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted">{t('colorPicker.custom')}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {favorites.map((color) => (
                    <ColorSwatch
                      key={color}
                      color={color}
                      selected={normalizedValue === color}
                      label={t('colorPicker.favorite', { color })}
                      onSelect={() => closeWith(color, true)}
                      onRemove={() => removeFavorite(color)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted"
              onClick={() => closeWith(null, false)}
            >
              {t('colorPicker.clear')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <div
        className="relative"
        data-color-picker-pipette=""
        onPointerDown={() => {
          if (disabled) return
          pipettePointerRef.current = true
        }}
        onPointerUp={() => {
          queueMicrotask(() => {
            pipettePointerRef.current = false
          })
        }}
        onPointerCancel={() => {
          pipettePointerRef.current = false
        }}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled}
          aria-label={t('colorPicker.pipette')}
          onClick={openNativePicker}
        >
          <Pipette className="size-3.5 text-muted" />
        </Button>
        <input
          ref={colorInputRef}
          type="color"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          defaultValue={NATIVE_PICKER_EMPTY_COLOR}
          className="pointer-events-none absolute size-px overflow-hidden opacity-0"
        />
      </div>
    </div>
  )
}
