import type { Client, ClientChannel } from 'ssh2'

/** Fixed non-interactive probe. The renderer never chooses this text. */
export const SHELL_PROBE_COMMAND = `printf '%s' "$SHELL"`

const SHELL_PROBE_TIMEOUT_MS = 4000

export type LoginShell = 'bash' | 'zsh'

/**
 * `$SHELL` is the login shell (`/bin/bash`, `/usr/bin/zsh`). Anything else,
 * including fish, dash, and ash, is not a shell we know how to hook.
 */
export function loginShell(value: string): LoginShell | null {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 256) return null
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return null
  }
  const base = trimmed.split(/[/\\]/).pop() ?? ''
  if (base === 'bash' || base === 'zsh') return base
  return null
}

/**
 * One line, appended to the existing hook. It emits OSC 7 and does not list files.
 * Bash keeps a string `PROMPT_COMMAND` or appends to the array form.
 */
export const BASH_OSC7_HOOK = [
  '__north_osc7(){ local LC_ALL=C i c o= p="$PWD";',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: bash source, not a JS template
  'for ((i=0;i<${#p};i++)); do c="${p:i:1}";',
  'case "$c" in [a-zA-Z0-9._~/-]) o+="$c";;',
  `*) printf -v c '%%%02X' "'$c"; o+="$c";;`,
  'esac; done;',
  'printf $\'\\033]7;file://localhost%s\\a\' "$o"; };',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: bash source, not a JS template
  'case ";${PROMPT_COMMAND:-};" in *__north_osc7*) ;;',
  '*) if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == declare\\ -a* ]]; then',
  'PROMPT_COMMAND+=(__north_osc7);',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: bash source, not a JS template
  'else PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }__north_osc7";',
  'fi;; esac; __north_osc7'
].join(' ')

/**
 * One line. `precmd_functions` is appended to, so an existing `precmd` stays.
 */
export const ZSH_OSC7_HOOK = [
  '__north_osc7(){ emulate -L zsh; local LC_ALL=C i c o= p="$PWD";',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh source, not a JS template
  'for ((i=1;i<=$#p;i++)); do c="${p[i]}";',
  'case "$c" in [a-zA-Z0-9._~/-]) o+="$c";;',
  `*) printf -v c '%%%02X' "'$c"; o+="$c";;`,
  'esac; done;',
  'printf $\'\\033]7;file://localhost%s\\a\' "$o"; };',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh source, not a JS template
  '[[ -n ${precmd_functions[(r)__north_osc7]} ]] || precmd_functions+=(__north_osc7);',
  '__north_osc7'
].join(' ')

export function osc7HookLine(shell: LoginShell): string {
  return shell === 'bash' ? BASH_OSC7_HOOK : ZSH_OSC7_HOOK
}

export type Osc7HookIo = {
  readShell: () => Promise<string | null>
  write: (line: string) => void
}

/**
 * Writes the fixed hook once, after the caller has already sent the startup `cd`.
 * No connection, another shell, or a failed probe writes nothing and does not throw.
 */
export async function installOsc7Hook(input: {
  connectionId: string | null
  isCancelled: () => boolean
  readShell: () => Promise<string | null>
  write: (line: string) => void
}): Promise<void> {
  if (!input.connectionId || input.isCancelled()) return
  let reported: string | null
  try {
    reported = await input.readShell()
  } catch {
    return
  }
  if (input.isCancelled() || reported == null) return
  const shell = loginShell(reported)
  if (!shell) return
  input.write(osc7HookLine(shell))
}

/**
 * Startup directory first, then the OSC 7 hook. A failure in either step
 * leaves the SSH session up.
 */
export async function runSavedShellStartup(input: {
  connectionId: string | null
  isCancelled: () => boolean
  applyStartup: () => Promise<string | null>
  readShell: () => Promise<string | null>
  write: (line: string) => void
}): Promise<string | null> {
  let notice: string | null = null
  try {
    notice = await input.applyStartup()
  } catch {
    notice = null
  }
  if (input.isCancelled()) return notice
  try {
    await installOsc7Hook(input)
  } catch {
    // The hook never fails the session.
  }
  return notice
}

/** Reads `$SHELL` on a new exec channel of the client that already owns the shell. */
export function readLoginShell(client: Client, isCancelled: () => boolean): Promise<string | null> {
  if (isCancelled()) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
      client.exec(SHELL_PROBE_COMMAND, (err, stream) => {
        if (err || !stream || isCancelled()) {
          finish(null)
          return
        }
        void collectShellProbe(stream, isCancelled).then(finish)
      })
    } catch {
      finish(null)
    }
  })
}

function collectShellProbe(
  stream: ClientChannel,
  isCancelled: () => boolean
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(value)
    }
    const chunks: Buffer[] = []
    let size = 0
    timer = setTimeout(() => {
      finish(null)
      try {
        stream.close()
      } catch {
        // The probe is best-effort.
      }
    }, SHELL_PROBE_TIMEOUT_MS)
    stream.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      if (size >= 512) return
      chunks.push(buf)
      size += buf.length
    })
    stream.stderr?.on('data', () => undefined)
    stream.on('error', () => finish(null))
    stream.on('close', () => {
      if (isCancelled()) {
        finish(null)
        return
      }
      finish(Buffer.concat(chunks).toString('utf8'))
    })
  })
}
