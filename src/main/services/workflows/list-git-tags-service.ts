import { shellQuote } from '@shared/lib/shell-quote'
import type { RemoteExecSession } from './remote-exec-service'

/**
 * `git fetch --tags` then lists tags, newest first — an ad-hoc, one-shot
 * action (not part of a workflow run) that powers a `select` input's
 * `gitTagsSource` in the run-parameters dialog. Same `git -C <path> ...`
 * pattern as `git-tracking-service.ts` (each `exec()` call has no
 * persisted cwd, so `-C` is required rather than `cd &&`).
 */
export async function listGitTags(
  exec: RemoteExecSession,
  repositoryPath: string
): Promise<string[]> {
  const path = shellQuote(repositoryPath)
  const command = `git -C ${path} fetch --tags --quiet && git -C ${path} tag --sort=-creatordate`
  const result = await exec.exec(command, { timeoutMs: 15_000 })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Não foi possível listar as tags do repositório')
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
