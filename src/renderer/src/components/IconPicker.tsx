import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { ENTITY_ICONS, resolveEntityIcon } from '@renderer/lib/entity-icons'
import { cn } from '@renderer/lib/utils'

type IconPickerProps = {
  value: string | null | undefined
  onChange: (icon: string | null) => void
  disabled?: boolean
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps): React.JSX.Element {
  const SelectedIcon = resolveEntityIcon(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 min-w-[7rem] justify-start gap-2.5 px-3"
          aria-label="Escolher ícone"
        >
          <SelectedIcon className="size-3.5 text-muted" />
          <span className="text-xs text-muted">{value ? 'Ícone' : 'Padrão'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {ENTITY_ICONS.map(({ id, label, Icon }) => {
            const selected = value === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground',
                  selected && 'bg-surface text-accent ring-1 ring-ring'
                )}
                onClick={() => onChange(id)}
              >
                <Icon className="size-3.5" />
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
