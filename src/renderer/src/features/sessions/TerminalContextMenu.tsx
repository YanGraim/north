import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  terminalCopyShortcutLabel,
  terminalPasteShortcutLabel,
  terminalSelectAllShortcutLabel
} from '@renderer/lib/terminal/clipboard'

type TerminalContextMenuProps = {
  children: React.ReactNode
  hasSelection: boolean
  linkUrl: string | null
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
  onCopyLink: () => void
  onClearSelection: () => void
}

export function TerminalContextMenu({
  children,
  hasSelection,
  linkUrl,
  onCopy,
  onPaste,
  onSelectAll,
  onCopyLink,
  onClearSelection
}: TerminalContextMenuProps): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={!hasSelection} onSelect={onCopy}>
          Copiar
          <ContextMenuShortcut>{terminalCopyShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste}>
          Colar
          <ContextMenuShortcut>{terminalPasteShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onSelectAll}>
          Selecionar tudo
          <ContextMenuShortcut>{terminalSelectAllShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        {linkUrl ? <ContextMenuItem onSelect={onCopyLink}>Copiar link</ContextMenuItem> : null}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!hasSelection} onSelect={onClearSelection}>
          Limpar seleção
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
