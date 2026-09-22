import { shellQuote } from '@shared/lib/shell-quote'
import { wrapCommandForAuth } from './auth-wrap'
import type { RemoteExecSession } from './remote-exec-service'

export type GitFetchCredentials = {
  username?: string
  password: string
}

/**
 * `git fetch --tags` then lists tags, newest first — an ad-hoc, one-shot
 * action (not part of a workflow run) that powers a `select` input's
 * `gitTagsSource` in the run-parameters dialog. Same `git -C <path> ...`
 * pattern as `git-tracking-service.ts` (each `exec()` call has no
 * persisted cwd, so `-C` is required rather than `cd &&`).
 *
 * `gitCredentials` — the connection's "Usuário Git"/"Senha Git" secrets,
 * when set — wrap the fetch with the same askpass+insteadOf mechanism
 * `ssh.exec` uses, so a private HTTPS remote (Bitbucket/GitHub/GitLab)
 * doesn't fail with "could not read Username" in this non-interactive exec.
 */
export async function listGitTags(
  exec: RemoteExecSession,
  repositoryPath: string,
  gitCredentials?: GitFetchCredentials
): Promise<string[]> {
  const path = shellQuote(repositoryPath)
  const command = `git -C ${path} fetch --tags --quiet && git -C ${path} tag --sort=-creatordate`
  const commandToRun = gitCredentials
    ? wrapCommandForAuth(command, ['git'], {
        gitUsername: gitCredentials.username,
        gitPassword: gitCredentials.password
      })
    : command
  const result = await exec.exec(commandToRun, { timeoutMs: 15_000 })
  if (result.exitCode !== 0) {
    const message = result.stderr.trim() || 'Não foi possível listar as tags do repositório'
    if (!gitCredentials && /could not read username|authentication failed/i.test(message)) {
      throw new Error(`${message} — preencha "Usuário Git" e "Senha Git" em Secrets, na conexão`)
    }
    throw new Error(message)
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
