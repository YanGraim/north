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
import { FilePlus, FolderInput, KeyRound, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  /** SSH connection only. The view decides; the menu only fires. */
  sshActions?: {
    onSetStartupDirectory: () => void
    onAddLogFile: () => void
    onFollowLog: () => void
  }
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
  onPasteSecret,
  sshActions
}: TerminalContextMenuProps): React.JSX.Element {
  const { t } = useTranslation()
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
        {sshActions ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!hasSelection} onSelect={sshActions.onSetStartupDirectory}>
              <FolderInput className="size-3.5" aria-hidden />
              {t('connection.terminalSelection.setDirectory')}
            </ContextMenuItem>
            <ContextMenuItem disabled={!hasSelection} onSelect={sshActions.onAddLogFile}>
              <FilePlus className="size-3.5" aria-hidden />
              {t('connection.terminalSelection.addLog')}
            </ContextMenuItem>
            <ContextMenuItem disabled={!hasSelection} onSelect={sshActions.onFollowLog}>
              <ScrollText className="size-3.5" aria-hidden />
              {t('connection.terminalSelection.followLog')}
            </ContextMenuItem>
          </>
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
