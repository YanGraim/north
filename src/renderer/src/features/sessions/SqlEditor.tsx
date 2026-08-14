import {
  acceptCompletion,
  autocompletion,
  completionKeymap,
  completionStatus
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { sql } from '@codemirror/lang-sql'
import { Compartment, EditorState, type Extension, Prec } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import type { DatabaseIntrospection, SqlStudioEngine } from '@shared/protocols'
import { useEffect, useRef } from 'react'
import {
  aliasCompletionRenderer,
  buildSqlConfig,
  completionOptionClass,
  expandTableAliasAtCursor,
  listTableNames,
  studioCompletionSources
} from './sql-autocomplete'
import { sqlEditorTheme, sqlHighlighting } from './sql-codemirror-theme'
import { formatStudioSql } from './sql-format'

export type SqlEditorHandle = {
  format: () => boolean
}

type SqlEditorProps = {
  value: string
  engine: SqlStudioEngine
  tree: DatabaseIntrospection | null
  onChange: (value: string) => void
  onRun: (sql: string) => void
  visible: boolean
  editorRef?: React.RefObject<SqlEditorHandle | null>
}

export function SqlEditor({
  value,
  engine,
  tree,
  onChange,
  onRun,
  visible,
  editorRef
}: SqlEditorProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sqlConfRef = useRef(new Compartment())
  const tablesRef = useRef<ReadonlySet<string>>(new Set())
  const engineRef = useRef(engine)
  const onRunRef = useRef(onRun)
  const onChangeRef = useRef(onChange)
  const editorRefBox = useRef(editorRef)
  onRunRef.current = onRun
  onChangeRef.current = onChange
  engineRef.current = engine
  editorRefBox.current = editorRef
  tablesRef.current = new Set(listTableNames(tree))

  // biome-ignore lint/correctness/useExhaustiveDependencies: create the editor once; schema syncs below
  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const sqlConf = sqlConfRef.current

    function formatCurrent(view: EditorView): boolean {
      return applySqlFormat(view, engineRef.current)
    }

    const config = buildSqlConfig(engine, tree)
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          sqlConf.of(sqlStudioSupport(config)),
          sqlHighlighting,
          sqlEditorTheme,
          EditorView.lineWrapping,
          placeholder('SELECT * FROM …'),
          Prec.highest(
            keymap.of([
              {
                key: 'Tab',
                run: (current) => {
                  if (completionStatus(current.state) === 'active') {
                    return acceptCompletion(current)
                  }
                  if (expandTableAliasAtCursor(current, engineRef.current, tablesRef.current)) {
                    return true
                  }
                  return false
                }
              }
            ])
          ),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: (current) => {
                const selected = current.state.sliceDoc(
                  current.state.selection.main.from,
                  current.state.selection.main.to
                )
                const sqlText = selected.trim() || current.state.doc.toString()
                onRunRef.current(sqlText)
                return true
              }
            },
            {
              key: 'Mod-Shift-f',
              run: formatCurrent
            },
            {
              key: 'Ctrl-Shift-f',
              run: formatCurrent
            },
            indentWithTab,
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          })
        ]
      }),
      parent: parentRef.current
    })
    viewRef.current = view
    const handle: SqlEditorHandle = { format: () => formatCurrent(view) }
    if (editorRefBox.current) editorRefBox.current.current = handle
    return () => {
      if (editorRefBox.current) editorRefBox.current.current = null
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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const config = buildSqlConfig(engine, tree)
    view.dispatch({
      effects: sqlConfRef.current.reconfigure(sqlStudioSupport(config))
    })
  }, [engine, tree])

  useEffect(() => {
    if (visible) {
      viewRef.current?.requestMeasure()
    }
  }, [visible])

  return <div ref={parentRef} className="h-full min-h-0 overflow-hidden" />
}

export function applySqlFormat(view: EditorView, engine: SqlStudioEngine): boolean {
  const { from, to } = view.state.selection.main
  const hasSelection = from !== to
  const source = hasSelection ? view.state.sliceDoc(from, to) : view.state.doc.toString()
  const formatted = formatStudioSql(engine, source)
  if (formatted === source) return true
  view.dispatch({
    changes: hasSelection
      ? { from, to, insert: formatted }
      : { from: 0, to: view.state.doc.length, insert: formatted }
  })
  return true
}

function sqlStudioSupport(config: ReturnType<typeof buildSqlConfig>): Extension {
  return [
    sql(config),
    autocompletion({
      activateOnTyping: true,
      override: studioCompletionSources(config),
      addToOptions: [{ render: aliasCompletionRenderer, position: 60 }],
      optionClass: completionOptionClass
    })
  ]
}
