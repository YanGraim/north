import { Button } from '@renderer/components/ui/button'
import { FileBrowserView } from '@renderer/features/sessions/FileBrowserView'
import { TerminalView } from '@renderer/features/sessions/TerminalView'
import {
  type SessionTab,
  sessionKindForProtocol,
  useSessionsStore,
  WORKSPACE_TAB_ID
} from '@renderer/stores/sessions-store'
import { lazy, Suspense } from 'react'

const DesktopView = lazy(() =>
  import('@renderer/features/sessions/DesktopView').then((m) => ({ default: m.DesktopView }))
)

type SessionViewProps = {
  tab: SessionTab
  visible: boolean
}

export function SessionView({ tab, visible }: SessionViewProps): React.JSX.Element {
  const closeTab = useSessionsStore((s) => s.closeTab)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const sessionKind =
    tab.sessionKind ?? (tab.protocol ? sessionKindForProtocol(tab.protocol) : undefined)

  if (tab.kind !== 'session') {
    return (
      <div
        className="flex h-full items-center justify-center bg-background text-sm text-muted"
        style={{ display: visible ? 'flex' : 'none' }}
        role="status"
      >
        Sessão indisponível
      </div>
    )
  }

  if (tab.state === 'error') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        style={{ display: visible ? 'flex' : 'none' }}
        role="alert"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Falha na sessão</p>
          <p className="max-w-md text-xs text-muted">
            {tab.errorMessage ?? 'Não foi possível conectar.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void closeTab(tab.id)}>
            Fechar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setActiveTab(WORKSPACE_TAB_ID)
            }}
          >
            Voltar ao Workspace
          </Button>
        </div>
      </div>
    )
  }

  if (tab.state === 'connecting' || !tab.sessionId) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2 bg-background p-6 text-center"
        style={{ display: visible ? 'flex' : 'none' }}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-foreground">
          {tab.awaitingHostKey ? 'Aguardando confirmação do host…' : 'Conectando…'}
        </p>
        <p className="max-w-sm text-xs text-muted">
          {tab.awaitingHostKey
            ? 'Confirme a fingerprint no diálogo para continuar. A aba Workspace permanece disponível.'
            : 'A sessão está sendo estabelecida. Você pode voltar ao Workspace pela aba no topo.'}
        </p>
      </div>
    )
  }

  if (sessionKind === 'terminal') {
    return (
      <TerminalView
        sessionId={tab.sessionId}
        visible={visible}
        title={tab.title}
        username={tab.username}
        host={tab.host}
      />
    )
  }

  if (!tab.port) {
    return (
      <div
        className="flex h-full items-center justify-center bg-background text-sm text-muted"
        style={{ display: visible ? 'flex' : 'none' }}
        role="status"
      >
        Sessão indisponível
      </div>
    )
  }

  switch (sessionKind) {
    case 'file-transfer':
      return <FileBrowserView sessionId={tab.sessionId} visible={visible} />
    case 'desktop':
      return (
        <Suspense
          fallback={
            <div
              className="flex h-full items-center justify-center bg-background text-sm text-muted"
              style={{ display: visible ? 'flex' : 'none' }}
            >
              Carregando desktop…
            </div>
          }
        >
          <DesktopView
            sessionId={tab.sessionId}
            port={tab.port}
            protocol={tab.protocol ?? 'vnc'}
            visible={visible}
          />
        </Suspense>
      )
    default:
      return (
        <div
          className="flex h-full items-center justify-center bg-background text-sm text-muted"
          style={{ display: visible ? 'flex' : 'none' }}
        >
          Tipo de sessão desconhecido
        </div>
      )
  }
}
