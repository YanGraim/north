import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** DBeaver-like token colors (keywords cool grey, identifiers/tables purple). */
export const sqlHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--cm-keyword)' },
  { tag: tags.operator, color: 'var(--cm-keyword)' },
  { tag: tags.bool, color: 'var(--cm-keyword)' },
  { tag: tags.null, color: 'var(--cm-keyword)' },
  { tag: tags.name, color: 'var(--cm-ident)' },
  { tag: tags.variableName, color: 'var(--cm-ident)' },
  { tag: tags.typeName, color: 'var(--cm-ident)' },
  { tag: tags.standard(tags.name), color: 'var(--cm-ident)' },
  { tag: tags.special(tags.name), color: 'var(--cm-ident)' },
  { tag: tags.special(tags.string), color: 'var(--cm-ident)' },
  { tag: tags.propertyName, color: 'var(--cm-ident)' },
  { tag: tags.string, color: 'var(--cm-string)' },
  { tag: tags.number, color: 'var(--cm-number)' },
  { tag: tags.comment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: tags.lineComment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: tags.blockComment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: tags.punctuation, color: 'var(--cm-punct)' },
  { tag: tags.paren, color: 'var(--cm-punct)' }
])

const autocompleteChrome: Record<string, Record<string, string | number>> = {
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface-elevated)',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 24px color-mix(in oklab, #000 35%, transparent)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px'
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    overflow: 'hidden'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
    maxHeight: '18rem',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: 'color-mix(in oklab, var(--color-muted) 45%, transparent) transparent'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.55rem',
    lineHeight: '1.35',
    borderRadius: 'calc(var(--radius-md) - 2px)',
    margin: '1px 2px'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'color-mix(in oklab, var(--color-accent) 38%, var(--color-surface-elevated))'
  },
  '.cm-completionLabel': {
    flex: '0 1 auto',
    minWidth: 0,
    color: 'var(--cm-ident)'
  },
  '.cm-completionAlias': {
    flex: '0 0 auto',
    color: 'var(--cm-ident-muted)',
    fontSize: '12px'
  },
  '.cm-completionDetail': {
    marginLeft: 'auto',
    paddingLeft: '0.5rem',
    fontSize: '10px',
    fontStyle: 'normal',
    color: 'var(--cm-kind)',
    opacity: 1
  },
  '.cm-completion-kind-keyword .cm-completionLabel': {
    color: 'var(--cm-keyword)'
  },
  '.cm-completion-kind-column .cm-completionLabel': {
    color: 'var(--cm-ident)'
  },
  '.cm-completionIcon': {
    flex: '0 0 auto',
    width: '0.9rem',
    opacity: 0.7,
    paddingRight: 0,
    marginRight: 0
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    fontWeight: 700,
    color: 'inherit'
  }
}

/** Shared CodeMirror chrome for SQL studio editors (dark North tokens). */
export const sqlEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '12.5px',
      backgroundColor: 'transparent',
      color: 'var(--color-foreground)'
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      lineHeight: '1.55'
    },
    '.cm-content': { caretColor: 'var(--color-foreground)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--color-muted)',
      border: 'none'
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in oklab, var(--color-accent) 12%, transparent)'
    },
    '&.cm-focused': { outline: 'none' },
    ...autocompleteChrome
  },
  { dark: true }
)

/** Compact single-line variant for the table filter bar. */
export const tableFilterTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      fontSize: '12px',
      backgroundColor: 'transparent',
      color: 'var(--color-foreground)'
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      lineHeight: '1.4',
      overflow: 'hidden'
    },
    '.cm-content': {
      caretColor: 'var(--color-foreground)',
      padding: '0.35rem 0.5rem',
      minHeight: '100%'
    },
    '.cm-line': {
      padding: 0
    },
    '&.cm-focused': { outline: 'none' },
    ...autocompleteChrome,
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      ...autocompleteChrome['.cm-tooltip.cm-tooltip-autocomplete > ul'],
      maxHeight: '12rem'
    },
    '.cm-placeholder': {
      color: 'var(--color-muted)',
      fontStyle: 'normal'
    }
  },
  { dark: true }
)

export const sqlHighlighting: Extension = syntaxHighlighting(sqlHighlightStyle)
