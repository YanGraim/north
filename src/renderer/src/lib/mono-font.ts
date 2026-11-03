export const MONO_FONT_FAMILIES = [
  'ibm-plex-mono',
  'jetbrains-mono',
  'ui-monospace',
  'menlo-consolas',
  'courier',
  'ubuntu-mono',
  'fira-code',
  'source-code-pro',
  'cascadia',
  'hack',
  'inconsolata',
  'roboto-mono',
  'space-mono',
  'noto-sans-mono'
] as const

export type MonoFontFamily = (typeof MONO_FONT_FAMILIES)[number]

export const DEFAULT_MONO_FONT_FAMILY: MonoFontFamily = 'ibm-plex-mono'

const MONO_FONT_FAMILY_SET: ReadonlySet<string> = new Set(MONO_FONT_FAMILIES)

/** Faces whose file does not change when ligatures are toggled. */
const MONO_FONT_STACKS: Record<Exclude<MonoFontFamily, 'cascadia'>, string> = {
  'ibm-plex-mono': '"IBM Plex Mono", "SF Mono", ui-monospace, monospace',
  'jetbrains-mono': '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
  'ui-monospace': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  'menlo-consolas': 'Menlo, Consolas, "SF Mono", monospace',
  courier: '"Courier New", Courier, monospace',
  'ubuntu-mono': '"Ubuntu Mono", "SF Mono", ui-monospace, monospace',
  'fira-code': '"Fira Code", "SF Mono", ui-monospace, monospace',
  'source-code-pro': '"Source Code Pro", "SF Mono", ui-monospace, monospace',
  hack: '"Hack", "SF Mono", ui-monospace, monospace',
  inconsolata: '"Inconsolata", "SF Mono", ui-monospace, monospace',
  'roboto-mono': '"Roboto Mono", "SF Mono", ui-monospace, monospace',
  'space-mono': '"Space Mono", "SF Mono", ui-monospace, monospace',
  'noto-sans-mono': '"Noto Sans Mono", "SF Mono", ui-monospace, monospace'
}

const CASCADIA_MONO_STACK = '"Cascadia Mono", "SF Mono", ui-monospace, monospace'
const CASCADIA_CODE_STACK = '"Cascadia Code", "SF Mono", ui-monospace, monospace'

export function sanitizeMonoFontFamily(value: unknown): MonoFontFamily {
  if (typeof value === 'string' && MONO_FONT_FAMILY_SET.has(value)) {
    return value as MonoFontFamily
  }
  return DEFAULT_MONO_FONT_FAMILY
}

/** Only a real boolean `true` turns ligatures on. Missing and junk values stay off. */
export function sanitizeMonoLigatures(value: unknown): boolean {
  return value === true
}

/** Every font-stack reader goes through here so Cascadia can follow the ligatures switch. */
export function resolveMonoFontStack(family: unknown, ligatures: unknown): string {
  const safeFamily = sanitizeMonoFontFamily(family)
  if (safeFamily === 'cascadia') {
    return sanitizeMonoLigatures(ligatures) ? CASCADIA_CODE_STACK : CASCADIA_MONO_STACK
  }
  return MONO_FONT_STACKS[safeFamily]
}
