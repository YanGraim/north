/**
 * Variable interpolation for workflows and the API client.
 * Syntax: {{KEY}} (literal substitution only).
 */

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

export type InterpolateContext = Record<string, string>

export function buildRunVariables(opts: {
  groupVariables: Record<string, string>
  inputDefaults: Record<string, string>
  inputValues: Record<string, string | boolean>
  runVariables?: Record<string, string>
}): InterpolateContext {
  const ctx: InterpolateContext = { ...opts.groupVariables, ...opts.inputDefaults }
  for (const [key, value] of Object.entries(opts.inputValues)) {
    ctx[key] = typeof value === 'boolean' ? (value ? 'true' : 'false') : value
  }
  if (opts.runVariables) {
    Object.assign(ctx, opts.runVariables)
  }
  return ctx
}

export function interpolate(template: string, ctx: InterpolateContext): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    if (Object.hasOwn(ctx, key)) {
      return ctx[key] ?? ''
    }
    return `{{${key}}}`
  })
}

export function interpolateDeep<T>(value: T, ctx: InterpolateContext): T {
  if (typeof value === 'string') {
    return interpolate(value, ctx) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateDeep(item, ctx)) as T
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = interpolateDeep(v, ctx)
    }
    return result as T
  }
  return value
}
