import { shellQuote } from '@shared/lib/shell-quote'
import type { EnvironmentUpdateCommit, WorkflowTracking } from '@shared/types'
import type { RemoteExecSession } from './remote-exec-service'

export type GitSnapshot = {
  commit: string
  branch: string
}

export type GitDelta = {
  currentCommit: string
  commits: EnvironmentUpdateCommit[]
  filesChanged: number
  tag: string | null
}

/**
 * Captures Git state on a remote repository before/after a workflow run, via
 * plain `git` commands over the same `RemoteExecSession` the run already
 * uses. Every method degrades to `null` on any failure (missing repo, not a
 * git checkout, network hiccup, detached HEAD, etc.) — tracking is always
 * best-effort and must never affect the workflow run itself.
 *
 * Commands use `git -C <path> ...` rather than `cd <path> && git ...`:
 * each `exec()` call opens an independent channel with no persisted cwd.
 */
export class GitTrackingService {
  async captureBefore(
    exec: RemoteExecSession,
    tracking: WorkflowTracking
  ): Promise<GitSnapshot | null> {
    try {
      const commit = await runGit(exec, tracking.repositoryPath, ['rev-parse', 'HEAD'])
      if (!commit) return null

      const branch = await resolveBranchLabel(exec, tracking)

      return { commit, branch }
    } catch (error) {
      warn('captureBefore failed', error)
      return null
    }
  }

  async captureAfter(
    exec: RemoteExecSession,
    tracking: WorkflowTracking,
    before: GitSnapshot
  ): Promise<GitDelta | null> {
    try {
      const currentCommit = await runGit(exec, tracking.repositoryPath, ['rev-parse', 'HEAD'])
      if (!currentCommit || currentCommit === before.commit) return null

      const range = `${before.commit}..${currentCommit}`
      const logOutput = await runGit(exec, tracking.repositoryPath, ['log', '--oneline', range])
      const commits = parseOnelineLog(logOutput ?? '')

      const nameOnlyOutput = await runGit(exec, tracking.repositoryPath, [
        'diff',
        '--name-only',
        range
      ])
      const filesChanged = countNonEmptyLines(nameOnlyOutput ?? '')

      const tag = await tagAt(exec, tracking.repositoryPath, currentCommit)

      return { currentCommit, commits, filesChanged, tag }
    } catch (error) {
      warn('captureAfter failed', error)
      return null
    }
  }
}

/**
 * `tracking.branch` if set; else whatever branch is checked out; else — for
 * a detached HEAD from `git checkout <tag>` (a tag-pinned deploy) — the tag
 * itself via `git describe`, so the snapshot never falls back to blank.
 */
async function resolveBranchLabel(
  exec: RemoteExecSession,
  tracking: WorkflowTracking
): Promise<string> {
  if (tracking.branch) return tracking.branch
  const currentBranch = await runGit(exec, tracking.repositoryPath, ['branch', '--show-current'])
  if (currentBranch) return currentBranch
  const tag = await runGit(exec, tracking.repositoryPath, ['describe', '--tags', '--exact-match'])
  return tag ?? ''
}

/** Newest version tag on the commit (for release notes); null when untagged or on any failure. */
async function tagAt(
  exec: RemoteExecSession,
  repositoryPath: string,
  commit: string
): Promise<string | null> {
  try {
    const tags = await runGit(exec, repositoryPath, [
      'tag',
      '--points-at',
      shellQuote(commit),
      '--sort=-v:refname'
    ])
    return tags?.split('\n')[0]?.trim() || null
  } catch {
    return null
  }
}

async function runGit(
  exec: RemoteExecSession,
  repositoryPath: string,
  args: string[]
): Promise<string | null> {
  const command = ['git', '-C', shellQuote(repositoryPath), ...args].join(' ')
  const result = await exec.exec(command, { timeoutMs: 15_000 })
  if (result.exitCode !== 0) return null
  const trimmed = result.stdout.trim()
  return trimmed
}

/** `git log --oneline` → one commit per line: `<hash> <message>`. */
function parseOnelineLog(output: string): EnvironmentUpdateCommit[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const spaceIndex = line.indexOf(' ')
      if (spaceIndex === -1) return { hash: line, message: '' }
      return {
        hash: line.slice(0, spaceIndex),
        message: line.slice(spaceIndex + 1).trim()
      }
    })
}

function countNonEmptyLines(output: string): number {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length
}

function warn(message: string, error: unknown): void {
  console.warn(
    `[workflows] git tracking: ${message}`,
    error instanceof Error ? error.message : error
  )
}
