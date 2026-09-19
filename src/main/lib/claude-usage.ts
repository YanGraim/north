import { execFile as execFileCb } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { readlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ClaudeUsage } from '@shared/protocols'

const execFileAsync = promisify(execFileCb)

/**
 * `claude-sonnet-5`'s documented max context window (confirmed via the
 * installed CLI's own model registry, `supports1m: true`) — the transcript
 * itself never records a session's actual window size, so this is the best
 * real signal we have for the % estimate, not an arbitrary guess.
 */
const CLAUDE_SONNET_5_CONTEXT_WINDOW = 1_000_000

/**
 * Mirrors Claude Code's own project-folder naming: the absolute cwd with
 * every `/` and `.` replaced by `-`. Undocumented, may change between
 * Claude Code versions — every caller here degrades to `null` on mismatch
 * rather than throwing, so a format change just means the chip disappears.
 */
export function claudeProjectSlug(cwd: string): string {
  return cwd.replace(/[/.]/g, '-')
}

type ProcessRow = { pid: number; ppid: number; comm: string }

/**
 * Finds a live `claude` process anywhere under `rootPid`'s process tree
 * (e.g. the user's shell) — Unix only (`ps` isn't available the same way on
 * Windows and the terminal feature there is out of scope for this).
 */
export async function findClaudeDescendantPid(
  rootPid: number,
  deps: { execFile?: typeof execFileAsync } = {}
): Promise<number | null> {
  if (process.platform === 'win32') return null
  const run = deps.execFile ?? execFileAsync

  let rows: ProcessRow[]
  try {
    const { stdout } = await run('ps', ['-Ao', 'pid,ppid,comm'])
    rows = stdout
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
        if (!match) return null
        return { pid: Number(match[1]), ppid: Number(match[2]), comm: match[3] }
      })
      .filter((row): row is ProcessRow => row !== null)
  } catch {
    return null
  }

  // `zsh -c claude` execs into `claude` directly (no fork) when the command
  // is a single simple word, so the root pid itself may already *be* claude.
  const rootRow = rows.find((row) => row.pid === rootPid)
  if (rootRow && /(^|\/)claude$/.test(rootRow.comm)) return rootPid

  const byPpid = new Map<number, ProcessRow[]>()
  for (const row of rows) {
    const siblings = byPpid.get(row.ppid) ?? []
    siblings.push(row)
    byPpid.set(row.ppid, siblings)
  }

  const queue = [rootPid]
  const seen = new Set<number>()
  while (queue.length > 0) {
    const pid = queue.shift() as number
    if (seen.has(pid)) continue
    seen.add(pid)
    for (const child of byPpid.get(pid) ?? []) {
      if (/(^|\/)claude$/.test(child.comm)) return child.pid
      queue.push(child.pid)
    }
  }
  return null
}

/** Working directory of a running process — Unix only (macOS via `lsof`, Linux via `/proc`). */
export async function cwdForPid(
  pid: number,
  deps: { execFile?: typeof execFileAsync; readlink?: typeof readlink } = {}
): Promise<string | null> {
  if (process.platform === 'win32') return null
  const run = deps.execFile ?? execFileAsync
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
      const line = stdout.split('\n').find((entry) => entry.startsWith('n/'))
      return line ? line.slice(1) : null
    }
    const readlinkFn = deps.readlink ?? readlink
    return await readlinkFn(`/proc/${pid}/cwd`)
  } catch {
    return null
  }
}

/**
 * Newest `.jsonl` transcript modified at/after `sinceMs` in the project's
 * Claude Code folder — i.e. the session that started when this pty did.
 */
export function findActiveClaudeSessionFile(
  cwd: string,
  sinceMs: number,
  homeDir: string = homedir()
): string | null {
  const dir = join(homeDir, '.claude', 'projects', claudeProjectSlug(cwd))

  let entries: string[]
  try {
    entries = readdirSync(dir).filter((name) => name.endsWith('.jsonl'))
  } catch {
    return null
  }

  let newest: { file: string; mtimeMs: number } | null = null
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      const { mtimeMs } = statSync(full)
      if (mtimeMs >= sinceMs && (!newest || mtimeMs > newest.mtimeMs)) {
        newest = { file: full, mtimeMs }
      }
    } catch {
      // file may have been removed mid-scan
    }
  }
  return newest?.file ?? null
}

/** Reads the last `usage` block in the transcript — Claude Code's own token accounting. */
export function readLatestClaudeUsage(filePath: string): ClaudeUsage | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const lines = content.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue

    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }

    const usage = (entry as { message?: { usage?: Record<string, number> } })?.message?.usage
    if (!usage) continue

    const inputTokens = usage.input_tokens ?? 0
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0
    const outputTokens = usage.output_tokens ?? 0
    const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens

    return {
      totalTokens,
      percentOfWindow: Math.min(
        100,
        Math.round((totalTokens / CLAUDE_SONNET_5_CONTEXT_WINDOW) * 100)
      ),
      contextWindow: CLAUDE_SONNET_5_CONTEXT_WINDOW,
      inputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      outputTokens
    }
  }
  return null
}
