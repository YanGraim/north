import type { RemoteEntry } from '@shared/protocols'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FilePane, type PaneSource } from './file-browser/FilePane'
import { listTerminalCwd } from './terminal-cwd-list'

type TerminalCwdPanelProps = {
  sessionId: string
  path: string | null
  visible: boolean
}

export function TerminalCwdPanel({
  sessionId,
  path,
  visible
}: TerminalCwdPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const pathRef = useRef(path)
  pathRef.current = path
  const sourceRef = useRef<PaneSource | null>(null)
  if (!sourceRef.current || sourceRef.current.sessionId !== sessionId) {
    sourceRef.current = {
      side: 'remote',
      sessionId,
      sep: '/',
      home: '/',
      roots: ['/'],
      list: (requested) => listTerminalCwd(sessionId, requested, pathRef.current),
      mkdir: async () => undefined,
      rename: async () => undefined,
      remove: async () => undefined,
      openFile: (_entry: RemoteEntry) => undefined
    }
  }
  const source = sourceRef.current

  if (!path) {
    return (
      <div
        className="flex h-full items-center justify-center p-4"
        data-testid="terminal-cwd-waiting"
        role="status"
      >
        <p className="text-center text-xs text-muted">{t('connection.terminalCwd.waiting')}</p>
      </div>
    )
  }

  return (
    <FilePane
      mirror
      source={source}
      path={path}
      onPathChange={() => undefined}
      visible={visible}
      active={false}
      onActivate={() => undefined}
      onCopy={() => undefined}
      onDrop={() => undefined}
      copyLabel=""
    />
  )
}
