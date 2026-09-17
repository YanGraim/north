import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource
} from '@codemirror/autocomplete'

/** Chars allowed in a `{{name}}` token — matches the highlighter in variable-input-theme. */
const TOKEN_RE = /\{\{\s*[A-Za-z0-9_.-]*/

/**
 * Suggests known variable names while the cursor sits right after `{{` (with
 * an optional partial name already typed). Accepting a suggestion keeps the
 * `{{` and inserts the name, closing with `}}` only if not already there —
 * same shape as Postman/Insomnia's `{{var}}` autocomplete.
 */
export function createVariableCompletionSource(
  getVariables: () => readonly string[]
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(TOKEN_RE)
    if (!match) return null
    const typed = match.text.replace(/^\{\{\s*/, '')
    const from = match.to - typed.length
    const lowerTyped = typed.toLowerCase()

    const names = Array.from(new Set(getVariables())).filter((name) =>
      name.toLowerCase().includes(lowerTyped)
    )
    if (names.length === 0) return null

    names.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(lowerTyped) ? 0 : 1
      const bStarts = b.toLowerCase().startsWith(lowerTyped) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.localeCompare(b)
    })

    const options: Completion[] = names.map((name) => ({
      label: name,
      type: 'variable',
      apply(view, _completion, applyFrom, applyTo) {
        const after = view.state.sliceDoc(applyTo, applyTo + 2)
        const insert = after === '}}' ? name : `${name}}}`
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert },
          selection: { anchor: applyFrom + insert.length }
        })
      }
    }))

    return { from, options, validFor: /^[A-Za-z0-9_.-]*$/ }
  }
}

export function variableCompletionOptionClass(completion: Completion): string {
  return completion.type === 'variable' ? 'cm-completion-kind-variable' : ''
}
