import { execFile as execFileCb } from 'node:child_process'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const defaultExecFile = promisify(execFileCb)

export type GitWorktreeDeps = {
  execFile?: (
    file: string,
    args: readonly string[],
    options?: { cwd?: string }
  ) => Promise<{ stdout: string; stderr: string }>
}

/** Filesystem-safe branch segment for the worktree folder name. */
export function sanitizeBranchForPath(branch: string): string {
  const cleaned = branch
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'branch'
}

export function repoNameFromPath(repoPath: string): string {
  return basename(repoPath.replace(/[/\\]+$/, '')) || repoPath
}

export function worktreePathFor(repoPath: string, branch: string): string {
  return join(repoPath, '.north', 'worktrees', sanitizeBranchForPath(branch))
}

/** True if `branch` already exists as a local branch in `repoPath`. */
export async function branchExists(
  repoPath: string,
  branch: string,
  deps: GitWorktreeDeps = {}
): Promise<boolean> {
  const run = deps.execFile ?? defaultExecFile
  try {
    await run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd: repoPath
    })
    return true
  } catch {
    return false
  }
}

/**
 * Path of the worktree (main working tree or another `git worktree`) that
 * already has `branch` checked out, or `null` if it's free. Lets the UI warn
 * *before* attempting `git worktree add`, instead of only after git refuses.
 */
export async function findBranchWorktreePath(
  repoPath: string,
  branch: string,
  deps: GitWorktreeDeps = {}
): Promise<string | null> {
  const run = deps.execFile ?? defaultExecFile
  const { stdout } = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repoPath })
  const targetRef = `refs/heads/${branch}`
  let currentPath: string | null = null
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      currentPath = line.slice('worktree '.length).trim()
    } else if (line.startsWith('branch ') && currentPath) {
      if (line.slice('branch '.length).trim() === targetRef) return currentPath
      currentPath = null
    }
  }
  return null
}

/**
 * Creates a worktree for `branch` — a new branch if it doesn't exist yet
 * (`-b`), or a worktree checking out the existing branch otherwise (e.g. the
 * user points a workspace at `main` or another branch they already have).
 * Rethrows on failure (e.g. path already a worktree) — never safe to
 * ignore, unlike `stripQuarantine`'s warn-and-continue.
 */
export async function addWorktree(
  repoPath: string,
  branch: string,
  worktreePath: string,
  deps: GitWorktreeDeps = {}
): Promise<void> {
  const run = deps.execFile ?? defaultExecFile
  try {
    const exists = await branchExists(repoPath, branch, deps)
    const args = exists
      ? ['worktree', 'add', worktreePath, branch]
      : ['worktree', 'add', worktreePath, '-b', branch]
    await run('git', args, { cwd: repoPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const checkedOutMatch = message.match(
      /is already (?:checked out|used by worktree) at '?([^'\n]+)'?/
    )
    if (checkedOutMatch) {
      throw new Error(
        `A branch "${branch}" já está em uso em outra pasta de trabalho (${checkedOutMatch[1].trim()}) — o git não permite abrir a mesma branch em dois lugares ao mesmo tempo. Use outra branch para este workspace, ou libere a branch no outro lugar primeiro.`
      )
    }
    throw new Error(`Não foi possível criar a worktree: ${message}`)
  }
}

/**
 * Removes a worktree. No `--force` on purpose — if the worktree has
 * uncommitted changes, git refuses and the error surfaces to the user
 * instead of silently discarding work.
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  deps: GitWorktreeDeps = {}
): Promise<void> {
  const run = deps.execFile ?? defaultExecFile
  try {
    await run('git', ['worktree', 'remove', worktreePath], { cwd: repoPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Não foi possível remover a worktree (pode haver alterações não commitadas): ${message}`
    )
  }
}
