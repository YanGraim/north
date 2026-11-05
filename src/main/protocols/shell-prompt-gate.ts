import { parseOsc7Cwd } from '@shared/lib/osc7-cwd'
import { isSafePosixAbsolute } from '@shared/lib/selection-path'
import {
  canonicalPosixDir,
  normalizeStartupDirectory,
  resolveStartupDirectory,
  startupCdCommand
} from '@shared/lib/startup-directory'

const MAX_OSC_PAYLOAD = 8192

export type ShellCdRequest =
  | { ok: true; pending: boolean; command: string | null }
  | { ok: false; reason: 'invalid' }

/**
 * Resolves a panel path to a safe absolute before it can be quoted into `cd`.
 * `~` and `~/...` need the login directory. Relative paths and `~other` are refused.
 */
export function resolveShellCdPath(input: string, login: string | null): string | null {
  const normalized = normalizeStartupDirectory(input.trim())
  if (!normalized.ok || normalized.value == null) return null
  if (normalized.value === '~' || normalized.value.startsWith('~/')) {
    if (login == null || !isSafePosixAbsolute(login)) return null
    const resolved = canonicalPosixDir(resolveStartupDirectory(normalized.value, login))
    return isSafePosixAbsolute(resolved) ? resolved : null
  }
  const absolute = canonicalPosixDir(normalized.value)
  return isSafePosixAbsolute(absolute) ? absolute : null
}

/**
 * One pending `cd`. OSC 7 means the prompt is drawn and the line is empty.
 * Stdin after that dirties the line until it is emptied or a command starts.
 * A command (`\r`) waits for the next OSC 7. The renderer never sees the command text.
 */
export class ShellPromptGate {
  private phase: 'at-prompt' | 'line-dirty' | 'command-running' = 'command-running'
  private cwd: string | null = null
  private pending: string | null = null
  private line = ''
  private esc = false
  private csi = false
  private scan: OscScan = { mode: 'ground', code: '', payload: '', dropped: false }

  currentDirectory(): string | null {
    return this.cwd
  }

  cancel(): void {
    this.pending = null
  }

  request(path: string): ShellCdRequest {
    const target = canonicalPosixDir(path)
    if (!isSafePosixAbsolute(target)) return { ok: false, reason: 'invalid' }
    if (this.cwd === target) {
      this.pending = null
      return { ok: true, pending: false, command: null }
    }
    if (this.phase === 'at-prompt' && this.line.length === 0) {
      this.phase = 'command-running'
      this.pending = null
      return { ok: true, pending: false, command: startupCdCommand(target) }
    }
    this.pending = target
    return { ok: true, pending: true, command: null }
  }

  /** Returns a `cd` when a queued path can run on a prompt this chunk revealed. */
  noteStdout(bytes: Uint8Array): string | null {
    let command: string | null = null
    for (const payload of pushOsc7(this.scan, bytes)) {
      const path = parseOsc7Cwd(payload)
      if (path == null) continue
      this.cwd = path
      this.phase = 'at-prompt'
      this.line = ''
      this.esc = false
      this.csi = false
      const flushed = this.flush()
      if (flushed) command = flushed
    }
    return command
  }

  /** Returns a `cd` when the person clears the line while a path is waiting. */
  noteStdin(bytes: Uint8Array): string | null {
    let command: string | null = null
    for (const byte of bytes) {
      const flushed = this.noteByte(byte)
      if (flushed) command = flushed
    }
    return command
  }

  private noteByte(byte: number): string | null {
    if (this.phase === 'command-running') return null
    if (this.csi) {
      if (byte >= 0x40 && byte <= 0x7e) this.csi = false
      return null
    }
    if (this.esc) {
      this.esc = false
      if (byte === 0x5b) this.csi = true
      return null
    }
    if (byte === 0x1b) {
      this.esc = true
      return null
    }
    if (byte === 0x03 || byte === 0x0d || byte === 0x0a) {
      this.phase = 'command-running'
      this.line = ''
      return null
    }
    if (byte === 0x15) {
      this.line = ''
      this.phase = 'at-prompt'
      return this.flush()
    }
    if (byte === 0x7f || byte === 0x08) {
      if (this.line.length > 0) this.line = this.line.slice(0, -1)
      if (this.line.length === 0) {
        this.phase = 'at-prompt'
        return this.flush()
      }
      this.phase = 'line-dirty'
      return null
    }
    if (byte < 0x20) return null
    this.line += String.fromCharCode(byte)
    this.phase = 'line-dirty'
    return null
  }

  private flush(): string | null {
    if (this.pending == null || this.phase !== 'at-prompt' || this.line.length > 0) return null
    if (this.pending === this.cwd) {
      this.pending = null
      return null
    }
    const command = startupCdCommand(this.pending)
    this.pending = null
    this.phase = 'command-running'
    return command
  }
}

type OscMode = 'ground' | 'esc' | 'code' | 'payload' | 'st' | 'skip' | 'skip-st'

type OscScan = {
  mode: OscMode
  code: string
  payload: string
  dropped: boolean
}

function pushOsc7(scan: OscScan, bytes: Uint8Array): string[] {
  const found: string[] = []
  for (const byte of bytes) {
    const payload = stepOsc(scan, byte)
    if (payload != null) found.push(payload)
  }
  return found
}

function stepOsc(scan: OscScan, byte: number): string | null {
  if (scan.mode === 'ground') {
    if (byte === 0x1b) scan.mode = 'esc'
    return null
  }
  if (scan.mode === 'esc') {
    scan.mode = byte === 0x5d ? 'code' : 'ground'
    scan.code = ''
    return null
  }
  if (scan.mode === 'code') {
    if (byte >= 0x30 && byte <= 0x39 && scan.code.length < 8) {
      scan.code += String.fromCharCode(byte)
      return null
    }
    if (byte === 0x3b) {
      scan.mode = scan.code === '7' ? 'payload' : 'skip'
      scan.payload = ''
      scan.dropped = false
      return null
    }
    scan.mode = 'ground'
    return null
  }
  if (scan.mode === 'payload' || scan.mode === 'skip') {
    if (byte === 0x07) return finishOsc(scan, scan.mode === 'payload')
    if (byte === 0x1b) {
      scan.mode = scan.mode === 'payload' ? 'st' : 'skip-st'
      return null
    }
    if (scan.mode === 'payload') {
      if (scan.payload.length >= MAX_OSC_PAYLOAD) scan.dropped = true
      else scan.payload += String.fromCharCode(byte)
    }
    return null
  }
  const emit = scan.mode === 'st' && byte === 0x5c
  const payload = emit ? finishOsc(scan, true) : null
  if (!emit) scan.mode = 'ground'
  return payload
}

function finishOsc(scan: OscScan, emit: boolean): string | null {
  const payload = emit && !scan.dropped ? scan.payload : null
  scan.mode = 'ground'
  scan.payload = ''
  scan.code = ''
  scan.dropped = false
  return payload
}
