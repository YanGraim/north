import {
  acceptCompletion,
  autocompletion,
  completionKeymap,
  completionStatus
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, Prec, StateEffect, StateField } from '@codemirror/state'
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  EditorView,
  hoverTooltip,
  keymap
} from '@codemirror/view'
import { tableFilterTheme } from '@renderer/features/sessions/sql-codemirror-theme'
import { cn } from '@renderer/lib/utils'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createVariableCompletionSource,
  variableCompletionOptionClass
} from './variable-autocomplete'
import { variableTokenTheme } from './variable-input-theme'

export type VariableInputHandle = {
  focus: () => void
  select: () => void
}

type VariableInputProps = {
  value: string
  /** Names resolvable for the currently selected environment (no `{{}}`). */
  variables: readonly string[]
  /** Resolved value per variable name, shown in the hover tooltip over a `{{var}}` token. */
  variableValues?: Readonly<Record<string, string>>
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
  'aria-label'?: string
  'data-testid'?: string
}

const VARIABLE_TOKEN_RE = /\{\{\s*([A-Za-z0-9_.-]*)\s*\}\}/g

function buildVariableDecorations(text: string, known: ReadonlySet<string>): DecorationSet {
  const tokens: { from: number; to: number; cls: string }[] = []
  VARIABLE_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null = VARIABLE_TOKEN_RE.exec(text)
  while (match !== null) {
    const name = match[1].trim()
    const cls = name && known.has(name) ? 'cm-var-known' : 'cm-var-unknown'
    tokens.push({ from: match.index, to: match.index + match[0].length, cls })
    match = VARIABLE_TOKEN_RE.exec(text)
  }
  return Decoration.set(
    tokens.map((token) => Decoration.mark({ class: token.cls }).range(token.from, token.to))
  )
}

type VarFieldState = { known: ReadonlySet<string>; deco: DecorationSet }

const setKnownVariables = StateEffect.define<ReadonlySet<string>>()

const variableDecorationField = StateField.define<VarFieldState>({
  create(state) {
    const known = new Set<string>()
    return { known, deco: buildVariableDecorations(state.doc.toString(), known) }
  },
  update(value, tr) {
    let known = value.known
    let knownChanged = false
    for (const effect of tr.effects) {
      if (effect.is(setKnownVariables)) {
        known = effect.value
        knownChanged = true
      }
    }
    if (!tr.docChanged && !knownChanged) return value
    return { known, deco: buildVariableDecorations(tr.state.doc.toString(), known) }
  },
  provide: (field) => EditorView.decorations.of((view) => view.state.field(field).deco)
})

/**
 * Single-line CodeMirror input aware of `{{variable}}` tokens: known names
 * (from `variables`) render as an accent-colored pill, unresolved ones as a
 * red wavy underline, and typing `{{` opens an autocomplete list of the
 * available names — the same UX Postman/Insomnia use for environment vars.
 * Drop-in replacement for `<Input>` (same value/onChange/className shape).
 */
export const VariableInput = forwardRef<VariableInputHandle, VariableInputProps>(
  function VariableInput(
    {
      value,
      variables,
      variableValues,
      onChange,
      onSubmit,
      placeholder,
      className,
      'aria-label': ariaLabel,
      'data-testid': testId
    },
    ref
  ) {
    const { t } = useTranslation()
    const parentRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onSubmitRef = useRef(onSubmit)
    const variablesRef = useRef(variables)
    const variableValuesRef = useRef(variableValues)
    const tRef = useRef(t)
    onChangeRef.current = onChange
    onSubmitRef.current = onSubmit
    variablesRef.current = variables
    variableValuesRef.current = variableValues
    tRef.current = t

    useImperativeHandle(
      ref,
      () => ({
        focus: () => viewRef.current?.focus(),
        select: () => {
          const view = viewRef.current
          if (!view) return
          view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
        }
      }),
      []
    )

    // biome-ignore lint/correctness/useExhaustiveDependencies: create once; value/variables synced via refs/effects below
    useEffect(() => {
      if (!parentRef.current || viewRef.current) return
      const source = createVariableCompletionSource(() => variablesRef.current)
      const view = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions: [
            history(),
            variableDecorationField,
            autocompletion({
              activateOnTyping: true,
              override: [source],
              optionClass: variableCompletionOptionClass
            }),
            tableFilterTheme,
            variableTokenTheme,
            cmPlaceholder(placeholder ?? ''),
            EditorState.transactionFilter.of((tr) => {
              if (!tr.docChanged) return tr
              if (tr.newDoc.lines <= 1) return tr
              return []
            }),
            Prec.highest(
              keymap.of([
                {
                  key: 'Enter',
                  run: (current) => {
                    if (completionStatus(current.state) === 'active') {
                      return acceptCompletion(current)
                    }
                    onSubmitRef.current?.()
                    return true
                  }
                },
                {
                  key: 'Tab',
                  run: (current) => {
                    if (completionStatus(current.state) === 'active') {
                      return acceptCompletion(current)
                    }
                    return false
                  }
                }
              ])
            ),
            keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString())
              }
            }),
            hoverTooltip((cmView, pos) => {
              const text = cmView.state.doc.toString()
              VARIABLE_TOKEN_RE.lastIndex = 0
              let match: RegExpExecArray | null = VARIABLE_TOKEN_RE.exec(text)
              while (match !== null) {
                const start = match.index
                const end = start + match[0].length
                if (pos >= start && pos <= end) {
                  const name = match[1].trim()
                  const known = variablesRef.current.includes(name)
                  const resolved = variableValuesRef.current?.[name]
                  const label = !name
                    ? null
                    : !known
                      ? tRef.current('api.studio.variableUnknown')
                      : resolved
                        ? resolved
                        : tRef.current('api.studio.variableEmpty')
                  if (!label) return null
                  return {
                    pos: start,
                    end,
                    above: true,
                    create: () => {
                      const dom = document.createElement('div')
                      dom.className =
                        'max-w-xs truncate rounded-md border border-border bg-surface-elevated px-2 py-1 font-mono text-[11px] text-foreground shadow-md'
                      dom.textContent = label
                      return { dom }
                    }
                  }
                }
                match = VARIABLE_TOKEN_RE.exec(text)
              }
              return null
            }),
            ...(ariaLabel ? [EditorView.contentAttributes.of({ 'aria-label': ariaLabel })] : [])
          ]
        }),
        parent: parentRef.current
      })
      view.dispatch({ effects: setKnownVariables.of(new Set(variablesRef.current)) })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      if (view.state.doc.toString() !== value) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
      }
    }, [value])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({ effects: setKnownVariables.of(new Set(variables)) })
    }, [variables])

    return (
      <div
        className={cn(
          'flex h-9 min-w-0 items-stretch overflow-hidden rounded-md border border-border bg-surface-elevated text-sm text-foreground transition-colors',
          'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
          className
        )}
        data-testid={testId}
      >
        <div ref={parentRef} className="min-w-0 flex-1 overflow-hidden" />
      </div>
    )
  }
)
