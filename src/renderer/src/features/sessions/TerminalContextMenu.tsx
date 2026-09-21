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
  terminalCutShortcutLabel,
  terminalPasteShortcutLabel,
  terminalSelectAllShortcutLabel
} from '@renderer/lib/terminal/clipboard'
import { KeyRound } from 'lucide-react'

type TerminalContextMenuProps = {
  children: React.ReactNode
  hasSelection: boolean
  linkUrl: string | null
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onSelectAll: () => void
  onCopyLink: () => void
  onClearSelection: () => void
  /** Only offered when the session belongs to a connection with a stored sudo/login password. */
  onPasteSecret?: () => void
}

export function TerminalContextMenu({
  children,
  hasSelection,
  linkUrl,
  onCopy,
  onCut,
  onPaste,
  onSelectAll,
  onCopyLink,
  onClearSelection,
  onPasteSecret
}: TerminalContextMenuProps): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={!hasSelection} onSelect={onCut}>
          Cortar
          <ContextMenuShortcut>{terminalCutShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={onCopy}>
          Copiar
          <ContextMenuShortcut>{terminalCopyShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste}>
          Colar
          <ContextMenuShortcut>{terminalPasteShortcutLabel()}</ContextMenuShortcut>
        </ContextMenuItem>
        {onPasteSecret ? (
          <ContextMenuItem onSelect={onPasteSecret}>
            <KeyRound className="size-3.5" aria-hidden />
            Colar senha salva
          </ContextMenuItem>
        ) : null}
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
