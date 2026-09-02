import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { codeFolding, foldGutter } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { placeholder as cmPlaceholder, EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { sqlEditorTheme, sqlHighlighting } from '../sql-codemirror-theme'

type JsonEditorProps = {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  fold?: boolean
  placeholder?: string
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  fold = false,
  placeholder
}: JsonEditorProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // biome-ignore lint/correctness/useExhaustiveDependencies: create the editor once; value syncs below
  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const editable = editableRef.current
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          json(),
          sqlHighlighting,
          sqlEditorTheme,
          EditorView.lineWrapping,
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          ...(fold ? [codeFolding(), foldGutter()] : []),
          editable.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString())
            }
          })
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
    view.dispatch({
      effects: editableRef.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly)
      ])
    })
  }, [readOnly])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value }
    })
  }, [value])

  return <div ref={parentRef} className="h-full min-h-0 overflow-hidden" />
}
