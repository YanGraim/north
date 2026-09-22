import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import type { WorkflowInput } from '@shared/types'
import { GitBranch, Plus, Trash2 } from 'lucide-react'

type SelectSource = 'fixed' | 'git-tags'

type WorkflowInputsEditorProps = {
  inputs: WorkflowInput[]
  onChange: (inputs: WorkflowInput[]) => void
  /** Prefilled into a new git-tags input's repo path — usually the same repo as tracking. */
  suggestedRepositoryPath?: string
}

function newInput(): WorkflowInput {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    type: 'string',
    required: false
  }
}

function selectSourceOf(input: WorkflowInput): SelectSource {
  return input.gitTagsSource ? 'git-tags' : 'fixed'
}

/** `label=value` per line, or just `value` (label defaults to value). */
function optionsToText(options: WorkflowInput['options']): string {
  return (options ?? [])
    .map((o) => (o.label === o.value ? o.value : `${o.label}=${o.value}`))
    .join('\n')
}

function optionsFromText(text: string): WorkflowInput['options'] {
  const options = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=')
      if (eq === -1) return { label: line, value: line }
      return { label: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() }
    })
  return options.length > 0 ? options : undefined
}

/**
 * Editor for a workflow's run-time inputs (params.tsx asks for these before
 * "Executar") — free text, a fixed-choice dropdown, or a dropdown populated
 * live from `git tag` on a remote repo (e.g. picking a deploy tag).
 */
export function WorkflowInputsEditor({
  inputs,
  onChange,
  suggestedRepositoryPath
}: WorkflowInputsEditorProps): React.JSX.Element {
  function update(id: string, patch: Partial<WorkflowInput>): void {
    onChange(inputs.map((input) => (input.id === id ? { ...input, ...patch } : input)))
  }

  function remove(id: string): void {
    onChange(inputs.filter((input) => input.id !== id))
  }

  function add(): void {
    onChange([...inputs, newInput()])
  }

  /** One click instead of 7 clicks: chave/rótulo/tipo/origem já vêm prontos para o caso mais comum — escolher uma tag de deploy. */
  function addGitTagShortcut(): void {
    const usedKeys = new Set(inputs.map((i) => i.key))
    let key = 'tag'
    for (let n = 2; usedKeys.has(key); n++) key = `tag${n}`

    onChange([
      ...inputs,
      {
        id: crypto.randomUUID(),
        key,
        label: 'Tag de deploy',
        type: 'select',
        required: true,
        gitTagsSource: { repositoryPath: suggestedRepositoryPath ?? '' }
      }
    ])
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border px-3 py-2">
      <legend className="px-1 text-xs font-medium text-foreground">
        Inputs (opcional) — pedidos antes de executar
      </legend>
      {inputs.length === 0 ? (
        <p className="text-xs text-muted">
          Nenhum input. Use pra valores que mudam a cada execução, referenciados no comando como{' '}
          <code className="font-mono">{'{{chave}}'}</code>. Pra escolher uma tag de deploy num
          dropdown com as tags reais do Git, use o atalho abaixo.
        </p>
      ) : null}
      <div className="space-y-3">
        {inputs.map((input, index) => (
          <div key={input.id} className="space-y-2 rounded-md border border-border/70 p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`wf-input-key-${input.id}`}>Chave</Label>
                <Input
                  id={`wf-input-key-${input.id}`}
                  placeholder="tag"
                  value={input.key}
                  className="font-mono text-xs"
                  onChange={(e) => update(input.id, { key: e.target.value.trim() })}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`wf-input-label-${input.id}`}>Rótulo</Label>
                <Input
                  id={`wf-input-label-${input.id}`}
                  placeholder="Tag de deploy"
                  value={input.label}
                  onChange={(e) => update(input.id, { label: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-5 shrink-0 text-muted hover:text-red-400"
                aria-label={`Remover input ${index + 1}`}
                onClick={() => remove(input.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`wf-input-type-${input.id}`}>Tipo</Label>
                <Select
                  value={input.type}
                  onValueChange={(value) =>
                    update(input.id, { type: value as WorkflowInput['type'] })
                  }
                >
                  <SelectTrigger id={`wf-input-type-${input.id}`} className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Texto</SelectItem>
                    <SelectItem value="select">Lista (dropdown)</SelectItem>
                    <SelectItem value="boolean">Sim/não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={input.required}
                  onChange={(e) => update(input.id, { required: e.target.checked })}
                />
                Obrigatório
              </label>
            </div>

            {input.type === 'select' ? (
              <div className="space-y-2 border-t border-border/70 pt-2">
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Origem das opções</Label>
                  <Select
                    value={selectSourceOf(input)}
                    onValueChange={(value: SelectSource) =>
                      update(
                        input.id,
                        value === 'git-tags'
                          ? {
                              gitTagsSource: { repositoryPath: suggestedRepositoryPath ?? '' },
                              options: undefined
                            }
                          : { gitTagsSource: undefined }
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-56 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Opções fixas</SelectItem>
                      <SelectItem value="git-tags">Tags do Git (ao vivo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {input.gitTagsSource ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`wf-input-tagpath-${input.id}`}>
                      Caminho do repositório (no servidor)
                    </Label>
                    <Input
                      id={`wf-input-tagpath-${input.id}`}
                      placeholder="/var/www/html/wms-app"
                      value={input.gitTagsSource.repositoryPath}
                      className="font-mono text-xs"
                      onChange={(e) =>
                        update(input.id, { gitTagsSource: { repositoryPath: e.target.value } })
                      }
                    />
                    <p className="text-xs text-muted">
                      Ao clicar Executar, o North roda{' '}
                      <code className="font-mono">git fetch --tags</code> nesse caminho (pela mesma
                      conexão) e mostra as tags reais num dropdown.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor={`wf-input-options-${input.id}`}>
                      Opções (uma por linha — rótulo=valor, ou só o valor)
                    </Label>
                    <Textarea
                      id={`wf-input-options-${input.id}`}
                      placeholder={'Produção=prod\nHomologação=homolog'}
                      value={optionsToText(input.options)}
                      className="font-mono text-xs"
                      rows={3}
                      onChange={(e) =>
                        update(input.id, { options: optionsFromText(e.target.value) })
                      }
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}>
          <Plus className="size-3.5" />
          Adicionar input
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={addGitTagShortcut}
        >
          <GitBranch className="size-3.5" />
          Deploy por tag (Git)
        </Button>
      </div>
    </fieldset>
  )
}
