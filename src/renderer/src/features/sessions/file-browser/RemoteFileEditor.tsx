import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState, Prec } from '@codemirror/state'
import { drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { sqlEditorTheme } from '@renderer/features/sessions/sql-codemirror-theme'
import { useEffect, useRef } from 'react'

type RemoteFileEditorProps = {
  value: string
  onChange: (value: string) => void
  onSave: () => void
}

/** Plain-text CodeMirror. Remount with a new key when the open file changes. */
export function RemoteFileEditor({
  value,
  onChange,
  onSave
}: RemoteFileEditorProps): React.JSX.Element {
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const initialRef = useRef(value)
  const hostRef = useRef<HTMLDivElement>(null)
  onChangeRef.current = onChange
  onSaveRef.current = onSave

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: initialRef.current,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          sqlEditorTheme,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-s',
                preventDefault: true,
                run: () => {
                  onSaveRef.current()
                  return true
                }
              }
            ])
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          })
        ]
      })
    })
    return () => view.destroy()
  }, [])

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden"
      data-testid="remote-edit-editor"
    />
  )
}
