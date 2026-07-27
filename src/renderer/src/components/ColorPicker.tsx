import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ENTITY_COLORS } from '@renderer/lib/entity-colors'
import { cn } from '@renderer/lib/utils'
import { Check, Pipette } from 'lucide-react'

type ColorPickerProps = {
  value: string | null | undefined
  onChange: (color: string | null) => void
  disabled?: boolean
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps): React.JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 min-w-[10rem] justify-start gap-3 px-3"
          aria-label="Escolher cor"
        >
          <span
            className={cn(
              'size-4 shrink-0 rounded-full border',
              value ? 'border-transparent' : 'border-dashed border-muted'
            )}
            style={value ? { backgroundColor: value } : undefined}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-left text-xs text-muted">
            {value ? value : 'Nenhuma'}
          </span>
          <Pipette className="size-3.5 shrink-0 text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {ENTITY_COLORS.map((color) => {
            const selected = value === color
            return (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md border border-border transition-colors hover:opacity-90',
                  selected && 'ring-2 ring-ring'
                )}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
              >
                {selected ? <Check className="size-3.5 text-accent-foreground" /> : null}
              </button>
            )
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 w-full text-xs text-muted"
          onClick={() => onChange(null)}
        >
          Limpar
        </Button>
      </PopoverContent>
    </Popover>
  )
}
