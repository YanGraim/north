import { EditorView } from '@codemirror/view'

/**
 * Extra chrome layered on top of `tableFilterTheme`: colors a `{{name}}`
 * token differently depending on whether `name` resolves for the currently
 * selected environment — accent for a known variable, red for one that
 * won't resolve — plus a distinct color for variable entries in the
 * autocomplete list. Same idea as Postman/Insomnia's variable pills.
 */
export const variableTokenTheme = EditorView.theme(
  {
    '.cm-var-known': {
      color: 'var(--color-accent)',
      backgroundColor: 'color-mix(in oklab, var(--color-accent) 20%, transparent)',
      borderRadius: '3px'
    },
    '.cm-var-unknown': {
      color: 'var(--color-foreground)',
      backgroundColor: 'color-mix(in oklab, #ef4444 26%, transparent)',
      borderRadius: '3px',
      textDecorationLine: 'underline',
      textDecorationStyle: 'wavy',
      textDecorationColor: 'color-mix(in oklab, #ef4444 75%, transparent)'
    },
    '.cm-completion-kind-variable .cm-completionLabel': {
      color: 'var(--color-accent)'
    }
  },
  { dark: true }
)
