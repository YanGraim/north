import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { type FSWatcher, watch } from 'node:fs'
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyRemoteEdit,
  type ExternalEditor,
  type FsEditNotice,
  type FsEditOpenResult,
  type FsEditSaveResult,
  planExternalEditorSpawn,
  REMOTE_EDIT_MAX_BYTES,
  REMOTE_EDIT_SAMPLE_BYTES
} from '@shared/lib/remote-edit'
import type { FileTransferCapability } from '@shared/protocols'

const STABLE_MS = 400
const CONFIRM_MS = 200

type LiveEdit = {
  editId: string
  sessionId: string
  remotePath: string
  tempPath: string
  dir: string
  mode: 'internal' | 'external'
  closed: boolean
  uploading: boolean
  checking: boolean
  pending: boolean
  timer: ReturnType<typeof setTimeout> | null
  watcher: FSWatcher | null
  lastSize: number
  lastMtimeMs: number
}

const edits = new Map<string, LiveEdit>()

let lookupTransfer: (sessionId: string) => FileTransferCapability | null = () => null
let emitUploaded: (notice: FsEditNotice) => void = () => undefined
let emitFailed: (notice: FsEditNotice) => void = () => undefined

export function configureRemoteEdits(options: {
  lookup: (sessionId: string) => FileTransferCapability | null
  uploaded: (notice: FsEditNotice) => void
  failed: (notice: FsEditNotice) => void
}): void {
  lookupTransfer = options.lookup
  emitUploaded = options.uploaded
  emitFailed = options.failed
}

function editKey(sessionId: string, editId: string): string {
  return `${sessionId}:${editId}`
}

function splitRemoteFile(remotePath: string): { parent: string; name: string } | null {
  if (!remotePath.startsWith('/') || remotePath.includes('\0') || remotePath.includes('\\')) {
    return null
  }
  if (remotePath.split('/').includes('..')) return null
  const trimmed =
    remotePath.length > 1 && remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath
  const slash = trimmed.lastIndexOf('/')
  if (slash < 0) return null
  const name = trimmed.slice(slash + 1)
  if (!name || name === '.' || name === '..') return null
  const parent = slash === 0 ? '/' : trimmed.slice(0, slash)
  return { parent, name }
}

function tempFileName(name: string): string {
  let cleaned = ''
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0
    if (code < 32 || '<>:"|?*\\/'.includes(char)) cleaned += '_'
    else cleaned += char
  }
  return cleaned || 'file.txt'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function readPrefix(path: string, size: number): Promise<Buffer> {
  const length = Math.min(size, REMOTE_EDIT_SAMPLE_BYTES)
  if (length === 0) return Buffer.alloc(0)
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return buffer
  } finally {
    await handle.close()
  }
}

async function discard(edit: LiveEdit): Promise<void> {
  edit.closed = true
  if (edit.timer) clearTimeout(edit.timer)
  edit.timer = null
  edit.watcher?.close()
  edit.watcher = null
  await rm(edit.dir, { recursive: true, force: true }).catch(() => undefined)
}

function arm(edit: LiveEdit): void {
  if (edit.closed || edit.timer || edit.uploading) return
  edit.pending = true
  edit.timer = setTimeout(() => {
    edit.timer = null
    void confirmStable(edit)
  }, STABLE_MS)
}

function noticeOf(edit: LiveEdit): FsEditNotice {
  return { sessionId: edit.sessionId, editId: edit.editId, remotePath: edit.remotePath }
}

async function uploadExternal(edit: LiveEdit): Promise<void> {
  if (edit.closed || edit.mode !== 'external') return
  const transfer = lookupTransfer(edit.sessionId)
  if (!transfer) {
    if (!edit.closed) emitFailed(noticeOf(edit))
    return
  }
  edit.uploading = true
  try {
    await transfer.upload(edit.tempPath, edit.remotePath)
    if (edit.closed) return
    const next = await stat(edit.tempPath)
    edit.lastSize = next.size
    edit.lastMtimeMs = next.mtimeMs
    emitUploaded(noticeOf(edit))
  } catch {
    console.error('[remote-edit] upload failed')
    if (!edit.closed) emitFailed(noticeOf(edit))
  } finally {
    edit.uploading = false
    if (edit.pending && !edit.closed) arm(edit)
  }
}

async function confirmStable(edit: LiveEdit): Promise<void> {
  if (edit.closed || edit.uploading || edit.checking) return
  edit.checking = true
  edit.pending = false
  try {
    const first = await stat(edit.tempPath).catch(() => null)
    if (!first || edit.closed) return
    await delay(CONFIRM_MS)
    if (edit.closed) return
    const second = await stat(edit.tempPath).catch(() => null)
    if (!second || edit.closed) return
    if (first.size !== second.size || first.mtimeMs !== second.mtimeMs) {
      edit.pending = true
      return
    }
    const changed = second.size !== edit.lastSize || second.mtimeMs !== edit.lastMtimeMs
    if (changed) await uploadExternal(edit)
  } finally {
    edit.checking = false
    if (edit.pending && !edit.closed && !edit.uploading) arm(edit)
  }
}

function watchExternal(edit: LiveEdit): void {
  edit.watcher = watch(edit.dir, { persistent: true }, () => {
    if (edit.closed) return
    edit.pending = true
    arm(edit)
  })
  edit.watcher.on('error', () => {
    console.error('[remote-edit] watch failed')
    if (!edit.closed) emitFailed(noticeOf(edit))
  })
}

async function launchEditor(edit: LiveEdit, editor: ExternalEditor): Promise<FsEditOpenResult> {
  const plan = planExternalEditorSpawn({
    executable: editor.executable,
    tempPath: edit.tempPath,
    remotePath: edit.remotePath
  })
  if (!plan) {
    await discard(edit)
    return { ok: false, reason: 'editor-missing' }
  }
  try {
    watchExternal(edit)
  } catch {
    console.error('[remote-edit] watch failed')
    await discard(edit)
    return { ok: false, reason: 'unavailable' }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(plan.command, [...plan.args], {
        shell: false,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.once('error', (error: NodeJS.ErrnoException) => {
        console.error(`[remote-edit] spawn failed: ${error.code ?? 'error'}`)
        reject(error)
      })
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
    })
  } catch {
    await discard(edit)
    return { ok: false, reason: 'editor-missing' }
  }
  return { ok: true, editId: edit.editId, remotePath: edit.remotePath }
}

export async function openRemoteEdit(input: {
  sessionId: string
  remotePath: string
  editorId: string
  editors: ExternalEditor[]
  transfer: FileTransferCapability
}): Promise<FsEditOpenResult> {
  const parts = splitRemoteFile(input.remotePath)
  if (!parts) return { ok: false, reason: 'not-file' }

  let entries: Awaited<ReturnType<FileTransferCapability['list']>>
  try {
    entries = await input.transfer.list(parts.parent)
  } catch {
    console.error('[remote-edit] list failed')
    return { ok: false, reason: 'unavailable' }
  }
  const entry = entries.find((item) => item.name === parts.name)
  if (entry?.type !== 'file') return { ok: false, reason: 'not-file' }
  if (entry.size > REMOTE_EDIT_MAX_BYTES) return { ok: false, reason: 'too-large' }

  const external =
    input.editorId === 'internal' ? null : input.editors.find((item) => item.id === input.editorId)
  if (input.editorId !== 'internal' && !external) return { ok: false, reason: 'editor-missing' }

  const editId = randomUUID()
  const dir = join(tmpdir(), 'north-remote-edits', input.sessionId, editId)
  const tempPath = join(dir, tempFileName(parts.name))
  const edit: LiveEdit = {
    editId,
    sessionId: input.sessionId,
    remotePath: parts.parent === '/' ? `/${parts.name}` : `${parts.parent}/${parts.name}`,
    tempPath,
    dir,
    mode: external ? 'external' : 'internal',
    closed: false,
    uploading: false,
    checking: false,
    pending: false,
    timer: null,
    watcher: null,
    lastSize: 0,
    lastMtimeMs: 0
  }
  edits.set(editKey(input.sessionId, editId), edit)

  try {
    await mkdir(dir, { recursive: true })
    await input.transfer.download(edit.remotePath, tempPath)
    const downloaded = await stat(tempPath)
    if (downloaded.size > REMOTE_EDIT_MAX_BYTES) {
      await discard(edit)
      edits.delete(editKey(input.sessionId, editId))
      return { ok: false, reason: 'too-large' }
    }
    const sample = await readPrefix(tempPath, downloaded.size)
    const kind = classifyRemoteEdit(downloaded.size, sample)
    if (kind !== 'text') {
      await discard(edit)
      edits.delete(editKey(input.sessionId, editId))
      return { ok: false, reason: kind }
    }
    edit.lastSize = downloaded.size
    edit.lastMtimeMs = downloaded.mtimeMs
  } catch {
    console.error('[remote-edit] download failed')
    await discard(edit)
    edits.delete(editKey(input.sessionId, editId))
    return { ok: false, reason: 'unavailable' }
  }

  if (!external) {
    try {
      const content = await readFile(tempPath, 'utf8')
      return { ok: true, editId, remotePath: edit.remotePath, content }
    } catch {
      console.error('[remote-edit] read failed')
      await discard(edit)
      edits.delete(editKey(input.sessionId, editId))
      return { ok: false, reason: 'unavailable' }
    }
  }

  for (const current of [...edits.values()]) {
    if (
      current !== edit &&
      current.sessionId === input.sessionId &&
      current.remotePath === edit.remotePath &&
      current.mode === 'external' &&
      !current.closed
    ) {
      await discard(current)
      edits.delete(editKey(current.sessionId, current.editId))
    }
  }

  const opened = await launchEditor(edit, external)
  if (!opened.ok) edits.delete(editKey(input.sessionId, editId))
  return opened
}

export async function saveRemoteEdit(input: {
  sessionId: string
  editId: string
  content: string
}): Promise<FsEditSaveResult> {
  const edit = edits.get(editKey(input.sessionId, input.editId))
  if (!edit || edit.closed || edit.mode !== 'internal') return { ok: false, reason: 'closed' }
  if (Buffer.byteLength(input.content, 'utf8') > REMOTE_EDIT_MAX_BYTES) {
    return { ok: false, reason: 'unavailable' }
  }
  const transfer = lookupTransfer(input.sessionId)
  if (!transfer) return { ok: false, reason: 'unavailable' }
  try {
    await writeFile(edit.tempPath, input.content, 'utf8')
    if (edit.closed) return { ok: false, reason: 'closed' }
    await transfer.upload(edit.tempPath, edit.remotePath)
    if (edit.closed) return { ok: false, reason: 'closed' }
    const next = await stat(edit.tempPath).catch(() => null)
    if (next) {
      edit.lastSize = next.size
      edit.lastMtimeMs = next.mtimeMs
    }
    return { ok: true }
  } catch {
    console.error('[remote-edit] upload failed')
    return { ok: false, reason: 'unavailable' }
  }
}

export async function closeRemoteEdit(sessionId: string, editId: string): Promise<void> {
  const edit = edits.get(editKey(sessionId, editId))
  if (!edit) return
  edits.delete(editKey(sessionId, editId))
  await discard(edit)
}

export async function disposeRemoteEdits(sessionId: string): Promise<void> {
  const pending = [...edits.values()].filter((edit) => edit.sessionId === sessionId)
  await Promise.all(
    pending.map(async (edit) => {
      edits.delete(editKey(edit.sessionId, edit.editId))
      await discard(edit)
    })
  )
}

export async function disposeAllRemoteEdits(): Promise<void> {
  const pending = [...edits.values()]
  edits.clear()
  await Promise.all(pending.map((edit) => discard(edit)))
}
