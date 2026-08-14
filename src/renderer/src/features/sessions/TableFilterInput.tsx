import {
  acceptCompletion,
  autocompletion,
  type CompletionSource,
  completionKeymap,
  completionStatus
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, Prec } from '@codemirror/state'
import { placeholder as cmPlaceholder, EditorView, keymap } from '@codemirror/view'
import { cn } from '@renderer/lib/utils'
import type { SqlStudioEngine } from '@shared/protocols'
import { useEffect, useRef } from 'react'
import { completionOptionClass, createFilterCompletionSource } from './sql-autocomplete'
import { tableFilterTheme } from './sql-codemirror-theme'

type TableFilterInputProps = {
  value: string
  engine: SqlStudioEngine
  columns: readonly string[]
  placeholder: string
  'aria-label': string
  onChange: (value: string) => void
  onSubmit: () => void
  className?: string
}

export function TableFilterInput({
  value,
  engine,
  columns,
  placeholder,
  'aria-label': ariaLabel,
  onChange,
  onSubmit,
  className
}: TableFilterInputProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const engineRef = useRef(engine)
  const columnsRef = useRef(columns)
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit
  engineRef.current = engine
  columnsRef.current = columns

  // biome-ignore lint/correctness/useExhaustiveDependencies: create once; columns/engine read via refs
  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const source: CompletionSource = createFilterCompletionSource(
      () => engineRef.current,
      () => columnsRef.current
    )
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          autocompletion({
            activateOnTyping: true,
            override: [source],
            optionClass: completionOptionClass
          }),
          tableFilterTheme,
          cmPlaceholder(placeholder),
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
                  onSubmitRef.current()
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
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel })
        ]
      }),
      parent: parentRef.current
    })
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
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value }
      })
    }
  }, [value])

  return (
    <div
      className={cn(
        'flex h-7 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
        className
      )}
      data-testid="table-filter-input"
    >
      <div ref={parentRef} className="min-w-0 flex-1 overflow-hidden" />
    </div>
  )
}
