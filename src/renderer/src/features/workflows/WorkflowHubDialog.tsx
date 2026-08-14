import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  useCopyWorkflow,
  useCreateGroupVariable,
  useCreateWorkflow,
  useDeleteGroupVariable,
  useDeleteWorkflow,
  useGroupVariables,
  useUpdateWorkflow,
  useWorkflowRuns,
  useWorkflows
} from '@renderer/hooks/use-workflows'
import { cn } from '@renderer/lib/utils'
import {
  type AuthHint,
  emptyWorkflowDefinition,
  parseAuthHints,
  type Workflow,
  type WorkflowDefinition,
  type WorkflowStep
} from '@shared/types'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  LayoutList,
  Plus,
  Trash2,
  Workflow as WorkflowIcon
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WorkflowGroupTargetsPicker } from './WorkflowGroupTargetsPicker'

type WorkflowHubDialogProps = {
  groupId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a workflow when opening (e.g. Edit from connection panel). */
  initialWorkflowId?: string | null
  /** Open already in create/edit mode for a new workflow. */
  startInCreateMode?: boolean
}

type HubTab = 'workflows' | 'variables' | 'runs'
type EditorMode = 'idle' | 'create' | 'edit'
/** Classic = form simples (1 comando). Flow = canvas linear estilo n8n. */
type ViewMode = 'classic' | 'flow'

type EditableStep = {
  id: string
  name: string
  command: string
  cwd: string
  authHints: AuthHint[]
}

const VIEW_MODE_KEY = 'north.workflow-hub.view-mode'

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    return raw === 'flow' ? 'flow' : 'classic'
  } catch {
    return 'classic'
  }
}

function createDefaultStep(overrides?: Partial<EditableStep>): EditableStep {
  return {
    id: crypto.randomUUID(),
    name: 'Comando',
    command: 'echo hello',
    cwd: '',
    authHints: [],
    ...overrides
  }
}

function editorFieldsFromWorkflow(workflow: Workflow): {
  name: string
  steps: EditableStep[]
} {
  const steps: EditableStep[] = []
  for (const step of workflow.definition.steps) {
    if (step.type !== 'ssh.exec') continue
    const cfg =
      step.config !== null && typeof step.config === 'object'
        ? (step.config as { command?: string; cwd?: string })
        : {}
    steps.push({
      id: step.id,
      name: step.name,
      command: cfg.command ?? 'echo hello',
      cwd: cfg.cwd ?? '',
      authHints: parseAuthHints(step.config)
    })
  }
  return {
    name: workflow.name,
    steps: steps.length > 0 ? steps : [createDefaultStep()]
  }
}

function toDefinitionSteps(steps: EditableStep[]): WorkflowStep[] {
  return steps.map((step) => {
    const config: { command: string; cwd?: string; authHints: AuthHint[] } = {
      command: step.command.trim() || 'echo hello',
      authHints: step.authHints
    }
    const cwd = step.cwd.trim()
    if (cwd) config.cwd = cwd
    return {
      id: step.id,
      type: 'ssh.exec',
      name: step.name.trim() || 'Comando',
      policy: { onFailure: 'stop' },
      config
    }
  })
}

function AuthHintsFields({
  authHints,
  onToggle
}: {
  authHints: AuthHint[]
  onToggle: (hint: AuthHint, checked: boolean) => void
}): React.JSX.Element {
  return (
    <fieldset className="space-y-2 rounded-md border border-border px-3 py-2">
      <legend className="px-1 text-xs font-medium text-foreground">Credenciais (opcional)</legend>
      <p className="text-xs text-muted">
        Só marque se o remoto pedir user/senha. Se o Git já estiver configurado no servidor, deixe
        desmarcado.
      </p>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          data-testid="workflow-auth-hint-git"
          checked={authHints.includes('git')}
          onChange={(e) => onToggle('git', e.target.checked)}
        />
        Git
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          data-testid="workflow-auth-hint-sudo"
          checked={authHints.includes('sudo')}
          onChange={(e) => onToggle('sudo', e.target.checked)}
        />
        Sudo
      </label>
    </fieldset>
  )
}

export function WorkflowHubDialog({
  groupId,
  open,
  onOpenChange,
  initialWorkflowId = null,
  startInCreateMode = false
}: WorkflowHubDialogProps): React.JSX.Element {
  const { data: workflows = [] } = useWorkflows(groupId)
  const { data: variables = [] } = useGroupVariables(groupId)
  const { data: runs = [] } = useWorkflowRuns(groupId)
  const createWorkflow = useCreateWorkflow()
  const copyWorkflow = useCopyWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const createVariable = useCreateGroupVariable()
  const deleteVariable = useDeleteGroupVariable()

  const [tab, setTab] = useState<HubTab>('workflows')
  const [mode, setMode] = useState<EditorMode>('idle')
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = workflows.find((w) => w.id === selectedId) ?? null

  const [name, setName] = useState('')
  const [steps, setSteps] = useState<EditableStep[]>(() => [createDefaultStep()])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [alsoCreateInGroupIds, setAlsoCreateInGroupIds] = useState<string[]>([])
  const [copyPanelOpen, setCopyPanelOpen] = useState(false)
  const [copyTargetIds, setCopyTargetIds] = useState<string[]>([])
  const [allowDuplicateNames, setAllowDuplicateNames] = useState(false)
  const [copyHasNameConflict, setCopyHasNameConflict] = useState(false)
  const [varKey, setVarKey] = useState('')
  const [varValue, setVarValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  const activeStep = steps.find((s) => s.id === activeStepId) ?? steps[0] ?? null
  const classicStep = steps[0] ?? null

  function applyEditorFields(fields: { name: string; steps: EditableStep[] }): void {
    setName(fields.name)
    setSteps(fields.steps)
    setActiveStepId(fields.steps[0]?.id ?? null)
  }

  function resetCreateEditor(): void {
    const step = createDefaultStep()
    setName('')
    setSteps([step])
    setActiveStepId(step.id)
    setAlsoCreateInGroupIds([])
    setCopyPanelOpen(false)
    setCopyTargetIds([])
    setAllowDuplicateNames(false)
    setCopyHasNameConflict(false)
  }

  function changeViewMode(next: ViewMode): void {
    setViewMode(next)
    try {
      localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) return

    setTab('workflows')
    if (startInCreateMode) {
      setMode('create')
      setSelectedId(null)
      resetCreateEditor()
      return
    }
    if (initialWorkflowId) {
      const workflow = workflows.find((w) => w.id === initialWorkflowId)
      if (workflow) {
        setMode('edit')
        setSelectedId(workflow.id)
        applyEditorFields(editorFieldsFromWorkflow(workflow))
      } else {
        setMode('edit')
        setSelectedId(initialWorkflowId)
        resetCreateEditor()
      }
      return
    }
    // Gerenciar: já abre com o primeiro workflow selecionado (evita painel vazio feio).
    const first = workflows[0]
    if (first) {
      setMode('edit')
      setSelectedId(first.id)
      applyEditorFields(editorFieldsFromWorkflow(first))
      return
    }
    setMode('idle')
    setSelectedId(null)
  }, [open, startInCreateMode, initialWorkflowId, workflows])

  useEffect(() => {
    if (!open || startInCreateMode) return
    if (initialWorkflowId) {
      if (selectedId !== initialWorkflowId || name !== '') return
      const workflow = workflows.find((w) => w.id === initialWorkflowId)
      if (!workflow) return
      setMode('edit')
      setSelectedId(workflow.id)
      applyEditorFields(editorFieldsFromWorkflow(workflow))
      return
    }
    // Lista chegou depois do open (query): seleciona o primeiro se ainda estiver idle.
    if (mode !== 'idle' || selectedId || workflows.length === 0) return
    const first = workflows[0]
    if (!first) return
    setMode('edit')
    setSelectedId(first.id)
    applyEditorFields(editorFieldsFromWorkflow(first))
  }, [workflows, open, startInCreateMode, initialWorkflowId, selectedId, name, mode])

  useEffect(() => {
    if (open && (mode === 'create' || mode === 'edit')) {
      queueMicrotask(() => nameInputRef.current?.focus())
    }
  }, [open, mode])

  function enterCreateMode(): void {
    setMode('create')
    setSelectedId(null)
    resetCreateEditor()
  }

  function loadWorkflowIntoEditor(workflow: Workflow): void {
    setMode('edit')
    setSelectedId(workflow.id)
    applyEditorFields(editorFieldsFromWorkflow(workflow))
    setCopyPanelOpen(false)
    setCopyTargetIds([])
    setAlsoCreateInGroupIds([])
    setAllowDuplicateNames(false)
    setCopyHasNameConflict(false)
  }

  function updateStep(stepId: string, patch: Partial<EditableStep>): void {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)))
  }

  function updateActiveStep(patch: Partial<EditableStep>): void {
    if (!activeStep) return
    updateStep(activeStep.id, patch)
  }

  function toggleHintOnStep(stepId: string, hint: AuthHint, checked: boolean): void {
    const step = steps.find((s) => s.id === stepId)
    if (!step) return
    const next = checked
      ? step.authHints.includes(hint)
        ? step.authHints
        : [...step.authHints, hint]
      : step.authHints.filter((h) => h !== hint)
    updateStep(stepId, { authHints: next })
  }

  function addStep(): void {
    const step = createDefaultStep({ name: `Etapa ${steps.length + 1}` })
    setSteps((prev) => [...prev, step])
    setActiveStepId(step.id)
  }

  function removeStep(stepId: string): void {
    if (steps.length <= 1) return
    const index = steps.findIndex((s) => s.id === stepId)
    const next = steps.filter((s) => s.id !== stepId)
    setSteps(next)
    setActiveStepId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? null)
  }

  function moveStep(stepId: string, direction: -1 | 1): void {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.id === stepId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      if (!item) return prev
      next.splice(target, 0, item)
      return next
    })
  }

  function buildDefinition(base?: WorkflowDefinition): WorkflowDefinition {
    const definition = base ? structuredClone(base) : emptyWorkflowDefinition()
    if (viewMode === 'classic') {
      // Modo clássico: 1 comando (primeiro step). Descarta etapas extras do canvas.
      const first = classicStep ?? createDefaultStep()
      definition.steps = toDefinitionSteps([
        {
          ...first,
          name: first.name.trim() || 'Exec'
        }
      ])
      return definition
    }
    definition.steps = toDefinitionSteps(steps)
    return definition
  }

  async function handleSave(): Promise<void> {
    const trimmed = name.trim() || 'Novo workflow'
    if (mode === 'create') {
      const created = await createWorkflow.mutateAsync({
        groupId,
        name: trimmed,
        definition: buildDefinition()
      })
      if (alsoCreateInGroupIds.length > 0) {
        try {
          await copyWorkflow.mutateAsync({
            workflowId: created.id,
            targetGroupIds: alsoCreateInGroupIds,
            allowDuplicateNames
          })
        } catch {
          // toast via useCopyWorkflow onError — keep editor on created workflow
        }
      }
      setAlsoCreateInGroupIds([])
      setAllowDuplicateNames(false)
      setCopyHasNameConflict(false)
      setSelectedId(created.id)
      setName(created.name)
      setMode('edit')
      return
    }
    if (!selected) return
    await updateWorkflow.mutateAsync({
      id: selected.id,
      input: { name: trimmed, definition: buildDefinition(selected.definition) }
    })
  }

  async function handleCopyToGroups(): Promise<void> {
    if (!selected || copyTargetIds.length === 0) return
    if (copyHasNameConflict && !allowDuplicateNames) return
    try {
      await copyWorkflow.mutateAsync({
        workflowId: selected.id,
        targetGroupIds: copyTargetIds,
        allowDuplicateNames
      })
      setCopyPanelOpen(false)
      setCopyTargetIds([])
      setAllowDuplicateNames(false)
      setCopyHasNameConflict(false)
    } catch {
      // toast via useCopyWorkflow onError
    }
  }

  async function handleDelete(): Promise<void> {
    if (!selected) return
    const deletedId = selected.id
    await deleteWorkflow.mutateAsync({ id: deletedId, groupId })
    const next = workflows.find((w) => w.id !== deletedId)
    if (next) {
      loadWorkflowIntoEditor(next)
      return
    }
    setSelectedId(null)
    setMode('idle')
  }

  const editorTitle =
    mode === 'create'
      ? 'Novo workflow'
      : mode === 'edit' && selected
        ? `Editando: ${selected.name}`
        : null

  const editing = mode === 'create' || (mode === 'edit' && selected)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="workflow-hub-dialog"
        className="flex h-[min(80vh,640px)] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle>Workflows do grupo</DialogTitle>
          <DialogDescription>
            Crie e edite ações do grupo. Na conexão, use Executar para rodar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border px-4 pt-2">
          {(
            [
              ['workflows', 'Workflows'],
              ['variables', 'Variáveis'],
              ['runs', 'Histórico']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={id === 'variables' ? 'workflow-hub-variables-tab' : undefined}
              className={cn(
                'rounded-t-md px-3 py-1.5 text-sm',
                tab === id
                  ? 'border border-b-0 border-border bg-background text-foreground'
                  : 'text-muted hover:text-foreground'
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'workflows' ? (
          <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-3 overflow-hidden px-4 py-3">
            <div className="flex min-h-0 flex-col gap-2">
              <ScrollArea className="min-h-0 flex-1 rounded-md border border-border">
                <div className="space-y-1 p-2" data-testid="workflow-hub-list">
                  {workflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      type="button"
                      data-testid={`workflow-hub-item-${workflow.id}`}
                      className={cn(
                        'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm',
                        selectedId === workflow.id && mode === 'edit'
                          ? 'bg-accent/15 font-medium text-foreground ring-1 ring-accent/40'
                          : 'text-muted hover:bg-surface hover:text-foreground'
                      )}
                      onClick={() => loadWorkflowIntoEditor(workflow)}
                    >
                      <span className="truncate">{workflow.name}</span>
                    </button>
                  ))}
                  {mode === 'create' ? (
                    <div className="rounded-md bg-accent/15 px-2 py-1.5 text-sm font-medium text-foreground ring-1 ring-accent/40">
                      Novo workflow
                    </div>
                  ) : null}
                  {workflows.length === 0 && mode !== 'create' ? (
                    <p className="px-1 py-2 text-xs text-muted">Nenhum workflow ainda.</p>
                  ) : null}
                </div>
              </ScrollArea>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                data-testid="workflow-hub-create"
                onClick={() => enterCreateMode()}
              >
                <Plus className="size-3.5" />
                Novo workflow
              </Button>
            </div>

            <div className="flex min-h-0 flex-col overflow-auto" data-testid="workflow-hub-editor">
              {mode === 'idle' ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                  <WorkflowIcon className="size-8 text-muted" aria-hidden />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Nenhum workflow neste grupo
                    </p>
                    <p className="max-w-xs text-xs text-muted">
                      Crie o primeiro para rodar ações repetíveis nesta conexão.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="workflow-hub-empty-create"
                    onClick={() => enterCreateMode()}
                  >
                    <Plus className="size-3.5" />
                    Criar workflow
                  </Button>
                </div>
              ) : !selected && mode === 'edit' ? (
                <div className="flex flex-1 items-center justify-center px-4">
                  <p className="text-sm text-muted">Carregando workflow…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className="text-sm font-medium text-foreground"
                      data-testid="workflow-hub-editor-title"
                    >
                      {editorTitle}
                    </h3>
                    <fieldset
                      className="m-0 flex items-center rounded-md border border-border p-0.5"
                      data-testid="workflow-hub-view-mode"
                      aria-label="Modo de edição"
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn(
                          'size-7',
                          viewMode === 'classic' && 'bg-surface text-foreground'
                        )}
                        data-testid="workflow-hub-mode-classic"
                        aria-label="Modo clássico"
                        aria-pressed={viewMode === 'classic'}
                        onClick={() => changeViewMode('classic')}
                      >
                        <LayoutList className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn(
                          'size-7',
                          viewMode === 'flow' && 'bg-surface text-foreground'
                        )}
                        data-testid="workflow-hub-mode-flow"
                        aria-label="Modo fluxo"
                        aria-pressed={viewMode === 'flow'}
                        onClick={() => changeViewMode('flow')}
                      >
                        <WorkflowIcon className="size-3.5" />
                      </Button>
                    </fieldset>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="workflow-hub-name">Nome</Label>
                    <Input
                      id="workflow-hub-name"
                      ref={nameInputRef}
                      value={name}
                      data-testid="workflow-hub-new-name"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {viewMode === 'classic' && classicStep ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="workflow-hub-command">Comando</Label>
                        <Textarea
                          id="workflow-hub-command"
                          value={classicStep.command}
                          data-testid="workflow-hub-command"
                          onChange={(e) => updateStep(classicStep.id, { command: e.target.value })}
                          rows={4}
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted">
                          Use {'{{KEY}}'} para variáveis do grupo. No modo clássico o workflow tem
                          um comando. Para várias etapas, use o modo fluxo.
                        </p>
                      </div>
                      <AuthHintsFields
                        authHints={classicStep.authHints}
                        onToggle={(hint, checked) =>
                          toggleHintOnStep(classicStep.id, hint, checked)
                        }
                      />
                    </>
                  ) : null}

                  {viewMode === 'flow' ? (
                    <div className="space-y-3">
                      <div
                        className="overflow-x-auto rounded-md border border-border bg-surface/40 p-4"
                        data-testid="workflow-hub-flow-canvas"
                      >
                        <div className="flex min-w-min items-stretch gap-2">
                          {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center gap-2">
                              <button
                                type="button"
                                data-testid={`workflow-hub-step-${index}`}
                                className={cn(
                                  'w-40 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors',
                                  activeStep?.id === step.id
                                    ? 'border-accent/50 bg-accent/10 ring-1 ring-accent/40'
                                    : 'border-border bg-background hover:border-muted-foreground/40'
                                )}
                                onClick={() => setActiveStepId(step.id)}
                              >
                                <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted uppercase">
                                  ssh.exec
                                </span>
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {step.name || 'Sem nome'}
                                </span>
                                <span className="mt-1 block truncate font-mono text-[10px] text-muted">
                                  {step.command || '—'}
                                </span>
                              </button>
                              {index < steps.length - 1 ? (
                                <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                              ) : null}
                            </div>
                          ))}
                          <button
                            type="button"
                            data-testid="workflow-hub-add-step"
                            className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted hover:border-accent/50 hover:text-foreground"
                            onClick={() => addStep()}
                          >
                            <Plus className="size-4" />
                            <span className="text-xs">Etapa</span>
                          </button>
                        </div>
                      </div>

                      <ol className="sr-only" data-testid="workflow-hub-step-list">
                        {steps.map((step) => (
                          <li key={step.id}>{step.name}</li>
                        ))}
                      </ol>

                      {activeStep ? (
                        <div className="space-y-3 rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-foreground">Nó selecionado</p>
                            <div className="flex items-center gap-0.5">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                data-testid="workflow-hub-move-up"
                                disabled={steps.findIndex((s) => s.id === activeStep.id) <= 0}
                                aria-label="Mover etapa para cima"
                                onClick={() => moveStep(activeStep.id, -1)}
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                data-testid="workflow-hub-move-down"
                                disabled={
                                  steps.findIndex((s) => s.id === activeStep.id) >= steps.length - 1
                                }
                                aria-label="Mover etapa para baixo"
                                onClick={() => moveStep(activeStep.id, 1)}
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7 text-red-400 hover:text-red-300"
                                data-testid="workflow-hub-remove-step"
                                disabled={steps.length <= 1}
                                aria-label="Remover etapa"
                                onClick={() => removeStep(activeStep.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="workflow-hub-step-name">Nome da etapa</Label>
                            <Input
                              id="workflow-hub-step-name"
                              value={activeStep.name}
                              data-testid="workflow-hub-step-name"
                              onChange={(e) => updateActiveStep({ name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="workflow-hub-flow-command">Comando</Label>
                            <Textarea
                              id="workflow-hub-flow-command"
                              value={activeStep.command}
                              data-testid="workflow-hub-command"
                              onChange={(e) => updateActiveStep({ command: e.target.value })}
                              rows={3}
                              className="font-mono text-xs"
                            />
                            <p className="text-xs text-muted">
                              Use {'{{KEY}}'} para variáveis. Cada nó é um shell isolado — cwd não
                              persiste entre etapas.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="workflow-hub-cwd">Diretório (cwd)</Label>
                            <Input
                              id="workflow-hub-cwd"
                              value={activeStep.cwd}
                              data-testid="workflow-hub-cwd"
                              placeholder="/var/www/app"
                              className="font-mono text-xs"
                              onChange={(e) => updateActiveStep({ cwd: e.target.value })}
                            />
                          </div>
                          <AuthHintsFields
                            authHints={activeStep.authHints}
                            onToggle={(hint, checked) =>
                              toggleHintOnStep(activeStep.id, hint, checked)
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {editing ? (
                    <div className="space-y-3 pt-1">
                      {mode === 'create' ? (
                        <WorkflowGroupTargetsPicker
                          excludeGroupId={groupId}
                          selectedIds={alsoCreateInGroupIds}
                          onChange={setAlsoCreateInGroupIds}
                          title="Também criar nestes grupos"
                          workflowName={name}
                          allowDuplicateNames={allowDuplicateNames}
                          onAllowDuplicateNamesChange={setAllowDuplicateNames}
                        />
                      ) : null}

                      {mode === 'edit' && selected && copyPanelOpen ? (
                        <div className="space-y-2">
                          <WorkflowGroupTargetsPicker
                            excludeGroupId={groupId}
                            selectedIds={copyTargetIds}
                            onChange={setCopyTargetIds}
                            title="Copiar para"
                            workflowName={selected.name}
                            allowDuplicateNames={allowDuplicateNames}
                            onAllowDuplicateNamesChange={setAllowDuplicateNames}
                            onConflictChange={setCopyHasNameConflict}
                          />
                          <Button
                            type="button"
                            size="sm"
                            data-testid="workflow-hub-copy-confirm"
                            disabled={
                              copyTargetIds.length === 0 ||
                              copyWorkflow.isPending ||
                              (copyHasNameConflict && !allowDuplicateNames)
                            }
                            onClick={() => void handleCopyToGroups()}
                          >
                            Confirmar cópia
                          </Button>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-w-24"
                          data-testid="workflow-hub-save"
                          onClick={() => void handleSave()}
                        >
                          Salvar
                        </Button>
                        {mode === 'edit' && selected ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-testid="workflow-hub-copy"
                              aria-pressed={copyPanelOpen}
                              onClick={() => {
                                setCopyPanelOpen((open) => !open)
                                setCopyTargetIds([])
                                setAllowDuplicateNames(false)
                                setCopyHasNameConflict(false)
                              }}
                            >
                              <Copy className="size-3.5" />
                              Copiar para…
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-w-24 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                              data-testid="workflow-hub-delete"
                              onClick={() => void handleDelete()}
                            >
                              <Trash2 className="size-3.5" />
                              Excluir
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'variables' ? (
          <div
            className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3"
            data-testid="workflow-hub-variables"
          >
            <p className="text-xs text-muted">
              Variáveis de grupo são configuração plaintext — nunca coloque senhas aqui.
            </p>
            <ul className="space-y-1">
              {variables.map((variable) => (
                <li
                  key={variable.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <code className="font-mono text-xs text-accent">{variable.key}</code>
                  <span className="min-w-0 flex-1 truncate text-muted">{variable.value}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Excluir variável"
                    onClick={() => void deleteVariable.mutateAsync({ id: variable.id, groupId })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                value={varKey}
                data-testid="workflow-var-key"
                onChange={(e) => setVarKey(e.target.value)}
              />
              <Input
                placeholder="valor"
                value={varValue}
                data-testid="workflow-var-value"
                onChange={(e) => setVarValue(e.target.value)}
              />
              <Button
                type="button"
                className="shrink-0"
                data-testid="workflow-var-add"
                disabled={!varKey.trim()}
                onClick={() => {
                  void createVariable
                    .mutateAsync({
                      groupId,
                      key: varKey.trim(),
                      value: varValue
                    })
                    .then(() => {
                      setVarKey('')
                      setVarValue('')
                    })
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'runs' ? (
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-4 py-3">
            {runs.length === 0 ? (
              <li className="text-sm text-muted">Nenhum run ainda.</li>
            ) : (
              runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <span className="font-mono text-xs text-muted">{run.id.slice(0, 8)}</span>
                  <span>{run.status}</span>
                  <span className="text-xs text-muted">{run.mode}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
