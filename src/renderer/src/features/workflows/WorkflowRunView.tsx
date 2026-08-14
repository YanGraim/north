import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toastError } from '@renderer/lib/toast'
import type { SessionTab } from '@renderer/stores/sessions-store'
import {
  openConnectionSession,
  sessionKindForProtocol,
  useSessionsStore
} from '@renderer/stores/sessions-store'
import type { StepRunStatus, WorkflowRunEvent } from '@shared/types'
import { CheckCircle2, Circle, Copy, Loader2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type StepState = {
  id: string
  name: string
  index: number
  status: StepRunStatus | 'pending'
  durationMs?: number
  exitCode?: number
  logs: string[]
}

type WorkflowRunViewProps = {
  tab: SessionTab
}

export function WorkflowRunView({ tab }: WorkflowRunViewProps): React.JSX.Element {
  const runId = tab.workflowRunId
  const [totalSteps, setTotalSteps] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [runStatus, setRunStatus] = useState<string>('running')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [steps, setSteps] = useState<StepState[]>([])
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [paused, setPaused] = useState<{
    reason: 'confirm' | 'auth' | 'on_failure_ask'
    stepId: string
  } | null>(null)
  const [actionsDismissed, setActionsDismissed] = useState(false)
  const [authSecret, setAuthSecret] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [learnToSave, setLearnToSave] = useState(true)
  const [authKind, setAuthKind] = useState('sudo')
  const [authMessage, setAuthMessage] = useState('')
  const [needsUsername, setNeedsUsername] = useState(false)

  useEffect(() => {
    if (!runId) return
    setRunStatus('running')
    setCompletedSteps(0)
    setElapsedMs(0)
    setStartedAt(Date.now())
    setPaused(null)
    setActionsDismissed(false)
    setSelectedStepId(null)
  }, [runId])

  useEffect(() => {
    if (!runId) return
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 500)
    return () => window.clearInterval(tick)
  }, [runId, startedAt])

  useEffect(() => {
    if (!runId) return

    function onEvent(event: WorkflowRunEvent): void {
      switch (event.type) {
        case 'run_started':
          setTotalSteps(event.totalSteps)
          setRunStatus('running')
          break
        case 'run_progress':
          setCompletedSteps(event.completedSteps)
          break
        case 'step_started':
          setSteps((prev) =>
            prev.map((s) => (s.id === event.stepId ? { ...s, status: 'running' } : s))
          )
          setSelectedStepId(event.stepId)
          break
        case 'step_log':
          setSteps((prev) =>
            prev.map((s) =>
              s.id === event.stepId
                ? { ...s, logs: [...s.logs, `[${event.stream}] ${event.chunk}`] }
                : s
            )
          )
          break
        case 'step_finished':
          setSteps((prev) =>
            prev.map((s) =>
              s.id === event.stepId
                ? {
                    ...s,
                    status: event.status,
                    durationMs: event.durationMs,
                    exitCode: event.exitCode
                  }
                : s
            )
          )
          break
        case 'run_paused':
          setPaused({ reason: event.reason, stepId: event.stepId })
          setRunStatus('paused')
          break
        case 'auth_prompt':
          setAuthKind(event.kind)
          setAuthMessage(event.message)
          setNeedsUsername(Boolean(event.needsUsername))
          setPaused({ reason: 'auth', stepId: event.stepId })
          setRunStatus('paused')
          break
        case 'run_finished':
          setRunStatus(event.status)
          setPaused(null)
          setElapsedMs(event.durationMs)
          break
      }
    }

    void window.north.workflows.getRun(runId).then((run) => {
      if (!run) return
      setSteps(
        run.definitionSnapshot.steps.map((step, index) => ({
          id: step.id,
          name: step.name,
          index,
          status: 'pending',
          logs: []
        }))
      )
      setTotalSteps(run.definitionSnapshot.steps.length)
      if (run.status !== 'pending' && run.status !== 'running' && run.status !== 'paused') {
        setRunStatus(run.status)
      }
    })

    return window.north.workflows.onRunEvent(({ runId: eventRunId, event }) => {
      if (eventRunId !== runId) return
      onEvent(event)
    })
  }, [runId])

  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const selected = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null,
    [steps, selectedStepId]
  )

  const showFailureActions =
    paused?.reason === 'on_failure_ask' || (runStatus === 'failed' && !actionsDismissed)

  async function respond(
    action: 'confirm' | 'retry' | 'continue' | 'cancel' | 'provide_secret'
  ): Promise<void> {
    if (!runId) return
    try {
      if (action === 'provide_secret') {
        await window.north.workflows.respond({
          runId,
          action,
          secret: authSecret,
          username: needsUsername ? authUsername : undefined,
          secretKind: authKind,
          learnToSave
        })
        setAuthSecret('')
        setAuthUsername('')
        setPaused(null)
        return
      }
      await window.north.workflows.respond({ runId, action })
      setPaused(null)
    } catch (error) {
      toastError(error, 'Não foi possível responder ao run')
    }
  }

  async function handleFailureAction(action: 'retry' | 'continue' | 'cancel'): Promise<void> {
    // Live pause: engine is still waiting for a decision.
    if (paused?.reason === 'on_failure_ask') {
      await respond(action)
      return
    }

    // Run already finished as failed — respond() has nothing to talk to.
    if (runStatus !== 'failed' || !runId) return

    if (action === 'cancel') {
      await useSessionsStore.getState().closeTab(tab.id)
      return
    }

    if (action === 'continue') {
      setActionsDismissed(true)
      return
    }

    if (!tab.workflowId) {
      toastError(new Error('Workflow não encontrado nesta aba'), 'Não foi possível tentar de novo')
      return
    }

    try {
      const previous = await window.north.workflows.getRun(runId)
      if (!previous) {
        toastError(new Error('Run anterior não encontrado'), 'Não foi possível tentar de novo')
        return
      }
      const connectionId = tab.connectionId ?? previous.targets[0]?.connectionId
      if (!connectionId) {
        toastError(new Error('Conexão alvo ausente'), 'Não foi possível tentar de novo')
        return
      }
      const run = await window.north.workflows.run({
        workflowId: tab.workflowId,
        mode: previous.mode,
        targets: [{ connectionId }],
        inputValues: previous.inputValues
      })
      useSessionsStore.getState().attachWorkflowRunToTab(tab.id, run.id)
    } catch (error) {
      toastError(error, 'Não foi possível tentar de novo')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="workflow-run-view">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">{tab.workflowName ?? tab.title}</h2>
          <p className="text-xs text-muted" data-testid="workflow-run-progress">
            {completedSteps} / {totalSteps} · {percent}% · {(elapsedMs / 1000).toFixed(1)}s ·{' '}
            <span className="capitalize">{runStatus}</span>
          </p>
        </div>
        {showFailureActions ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              data-testid="workflow-run-retry"
              onClick={() => void handleFailureAction('retry')}
            >
              Retry
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              data-testid="workflow-run-continue"
              onClick={() => void handleFailureAction('continue')}
            >
              Continue
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              data-testid="workflow-run-cancel"
              onClick={() => void handleFailureAction('cancel')}
            >
              Cancelar
            </Button>
          </div>
        ) : null}
        {paused?.reason === 'confirm' ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              data-testid="workflow-run-confirm"
              onClick={() => void respond('confirm')}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void respond('cancel')}
            >
              Cancelar
            </Button>
          </div>
        ) : null}
        {runStatus === 'failed' && tab.connectionId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void openConnectionSession(tab.connectionId as string, {
                title: 'Shell',
                protocol: 'ssh',
                sessionKind: sessionKindForProtocol('ssh')
              })
            }
          >
            Abrir shell
          </Button>
        ) : null}
      </header>

      {paused?.reason === 'auth' ? (
        <div
          className="flex shrink-0 flex-wrap items-end gap-2 border-b border-border bg-surface px-4 py-3"
          data-testid="workflow-auth-prompt"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm text-foreground">{authMessage || `Senha (${authKind})`}</p>
            {needsUsername ? (
              <Input
                type="text"
                value={authUsername}
                data-testid="workflow-auth-username"
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Usuário"
                autoComplete="username"
              />
            ) : null}
            <Input
              type="password"
              value={authSecret}
              data-testid="workflow-auth-secret"
              onChange={(e) => setAuthSecret(e.target.value)}
              placeholder={needsUsername ? 'Senha' : 'Segredo'}
              autoComplete="current-password"
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={learnToSave}
                onChange={(e) => setLearnToSave(e.target.checked)}
              />
              Salvar na conexão (learn-to-save)
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="workflow-auth-submit"
            onClick={() => void respond('provide_secret')}
          >
            Enviar
          </Button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr]">
        <ScrollArea className="min-h-0 border-r border-border">
          <ol className="relative space-y-0 p-3" data-testid="workflow-run-timeline">
            {steps.map((step, index) => {
              const isSelected = (selectedStepId ?? steps[0]?.id) === step.id
              const isLast = index === steps.length - 1
              return (
                <li key={step.id} className="relative">
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="absolute top-7 bottom-0 left-[15px] w-px bg-border"
                    />
                  ) : null}
                  <button
                    type="button"
                    data-testid={`workflow-run-step-${index}`}
                    data-status={step.status}
                    className={`relative flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      isSelected ? 'bg-surface' : 'hover:bg-surface/60'
                    } ${step.status === 'failed' ? 'text-red-400' : 'text-foreground'}`}
                    onClick={() => setSelectedStepId(step.id)}
                  >
                    <span className="relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center bg-background">
                      <StepIcon status={step.status} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="shrink-0 text-[10px] font-medium text-muted tabular-nums">
                          {index + 1}/{steps.length}
                        </span>
                        <span className="truncate font-medium">{step.name}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        <StepStatusLabel step={step} />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </ScrollArea>

        <div className="relative min-h-0">
          <ScrollArea className="h-full min-h-0">
            <pre
              className="select-text whitespace-pre-wrap p-4 pr-28 font-mono text-xs text-foreground [-webkit-user-select:text]"
              data-testid="workflow-run-log"
            >
              {selected?.logs.join('') || 'Sem logs neste step.'}
            </pre>
          </ScrollArea>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 z-20 bg-background/90 backdrop-blur-sm"
            data-testid="workflow-run-copy-log"
            onClick={() => {
              const text = selected?.logs.join('') || ''
              void navigator.clipboard.writeText(text)
            }}
          >
            <Copy className="size-3.5" />
            Copiar log
          </Button>
        </div>
      </div>
    </div>
  )
}

function StepStatusLabel({ step }: { step: StepState }): React.JSX.Element {
  const duration = step.durationMs !== undefined ? ` · ${step.durationMs}ms` : ''
  const exit = step.exitCode !== undefined ? ` · exit ${step.exitCode}` : ''

  switch (step.status) {
    case 'running':
      return <>Em execução</>
    case 'succeeded':
      return (
        <>
          Concluída{duration}
          {exit}
        </>
      )
    case 'failed':
      return (
        <>
          Falhou{duration}
          {exit}
        </>
      )
    case 'cancelled':
      return <>Cancelada{duration}</>
    case 'skipped':
    case 'skipped_dry_run':
      return <>Ignorada{duration}</>
    default:
      return <>Pendente</>
  }
}

function StepIcon({ status }: { status: StepState['status'] }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" />
    case 'succeeded':
    case 'skipped_dry_run':
    case 'skipped':
      return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
    case 'failed':
    case 'cancelled':
      return <XCircle className="size-3.5 shrink-0 text-red-500" />
    default:
      return <Circle className="size-3.5 shrink-0 text-muted" />
  }
}
