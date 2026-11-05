import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  type ExternalEditor,
  ExternalEditorSchema,
  type SaveExternalEditorsResult,
  validateExternalEditorList
} from '@shared/lib/remote-edit'

export const EXTERNAL_EDITORS_FILE = 'external-editors.json'

export function externalEditorsPath(userData: string): string {
  return join(userData, EXTERNAL_EDITORS_FILE)
}

export function parseExternalEditors(raw: unknown): ExternalEditor[] {
  const record = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(record.editors) ? record.editors : []
  const editors: ExternalEditor[] = []
  for (const item of list) {
    const parsed = ExternalEditorSchema.safeParse(item)
    if (!parsed.success) continue
    if (validateExternalEditorList([parsed.data]) !== 'ok') continue
    editors.push(parsed.data)
  }
  return validateExternalEditorList(editors) === 'ok' ? editors : []
}

export function readExternalEditors(userData: string): ExternalEditor[] {
  try {
    return parseExternalEditors(JSON.parse(readFileSync(externalEditorsPath(userData), 'utf8')))
  } catch {
    return []
  }
}

function executableExists(executable: string): boolean {
  try {
    return statSync(executable).isFile()
  } catch {
    return false
  }
}

export function saveExternalEditors(
  userData: string,
  editors: ExternalEditor[]
): SaveExternalEditorsResult {
  if (validateExternalEditorList(editors) !== 'ok') return { ok: false, reason: 'invalid' }
  if (editors.some((editor) => !executableExists(editor.executable))) {
    return { ok: false, reason: 'missing-executable' }
  }
  const path = externalEditorsPath(userData)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ editors })}\n`)
  return { ok: true }
}
