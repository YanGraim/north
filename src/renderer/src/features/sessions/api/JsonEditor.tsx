import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { codeFolding, foldGutter } from '@codemirror/language'
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state'
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  EditorView,
  keymap
} from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { sqlEditorTheme, sqlHighlighting } from '../sql-codemirror-theme'
import type { TextMatch } from './find-in-text'

const CHEVRON_DOWN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
const CHEVRON_RIGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'

/** Lucide-style chevron, matching the tree/list fold affordances used elsewhere in the app. */
function foldMarkerDom(open: boolean): HTMLElement {
  const span = document.createElement('span')
  span.className = 'cm-fold-marker'
  span.innerHTML = open ? CHEVRON_DOWN_SVG : CHEVRON_RIGHT_SVG
  return span
}

const foldGutterTheme = EditorView.baseTheme({
  '.cm-foldGutter': {
    width: '0.95rem'
  },
  '.cm-foldGutter .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer'
  },
  '.cm-fold-marker': {
    display: 'inline-flex',
    color: 'var(--color-muted)',
    transition: 'color 150ms'
  },
  '.cm-fold-marker svg': {
    width: '0.7rem',
    height: '0.7rem'
  },
  '.cm-foldGutter .cm-gutterElement:hover .cm-fold-marker': {
    color: 'var(--color-foreground)'
  },
  '.cm-foldPlaceholder': {
    padding: '0 5px',
    margin: '0 2px',
    backgroundColor: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    color: 'var(--color-muted)',
    cursor: 'pointer',
    lineHeight: '1.4'
  },
  '.cm-foldPlaceholder:hover': {
    color: 'var(--color-foreground)',
    borderColor: 'color-mix(in oklab, var(--color-foreground) 25%, var(--color-border))'
  }
})

type JsonEditorProps = {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  fold?: boolean
  placeholder?: string
  /** Set to false for non-JSON content (e.g. HTML/plain-text responses) to skip the JSON parser/highlighting, which otherwise marks everything as a syntax error. */
  json?: boolean
}

export type JsonEditorHandle = {
  /** Highlight every match; scrolls to and emphasizes `activeIndex`. */
  highlightMatches: (matches: TextMatch[], activeIndex: number) => void
  clearMatches: () => void
}

const setSearchMatches = StateEffect.define<{ matches: TextMatch[]; active: number }>()

const searchMatchesField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        const { matches, active } = effect.value
        deco = Decoration.set(
          matches.map((match, index) =>
            Decoration.mark({
              class: index === active ? 'cm-search-match cm-search-match-active' : 'cm-search-match'
            }).range(match.from, match.to)
          )
        )
      }
    }
    return deco
  },
  provide: (field) => EditorView.decorations.from(field)
})

const searchMatchTheme = EditorView.baseTheme({
  '.cm-search-match': {
    backgroundColor: 'color-mix(in oklab, var(--color-accent) 30%, transparent)',
    borderRadius: '2px'
  },
  '.cm-search-match-active': {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-accent-foreground)'
  }
})

export const JsonEditor = forwardRef<JsonEditorHandle, JsonEditorProps>(function JsonEditor(
  { value, onChange, readOnly = false, fold = false, placeholder, json: isJson = true },
  ref
) {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())
  const languageRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useImperativeHandle(
    ref,
    () => ({
      highlightMatches(matches, activeIndex) {
        const view = viewRef.current
        if (!view) return
        view.dispatch({ effects: setSearchMatches.of({ matches, active: activeIndex }) })
        const active = matches[activeIndex]
        if (active) {
          view.dispatch({ effects: EditorView.scrollIntoView(active.from, { y: 'center' }) })
        }
      },
      clearMatches() {
        viewRef.current?.dispatch({ effects: setSearchMatches.of({ matches: [], active: -1 }) })
      }
    }),
    []
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: create the editor once; value syncs below
  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const editable = editableRef.current
    const language = languageRef.current
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          language.of(isJson ? [json()] : []),
          sqlHighlighting,
          sqlEditorTheme,
          searchMatchesField,
          searchMatchTheme,
          EditorView.lineWrapping,
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          ...(fold
            ? [codeFolding(), foldGutter({ markerDOM: foldMarkerDom }), foldGutterTheme]
            : []),
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
    view.dispatch({
      effects: languageRef.current.reconfigure(isJson ? [json()] : [])
    })
  }, [isJson])

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
})
