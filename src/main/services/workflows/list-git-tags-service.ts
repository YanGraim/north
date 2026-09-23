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
 *
 * `sudoPassword` — the connection's "Senha sudo" secret, when set — wraps
 * every command with `sudo -S`, the same way an `ssh.exec` step with the
 * sudo hint does, for repos only readable/fetchable as another user (e.g.
 * a deploy dir owned by `www-data`). Never prompts; if the secret isn't
 * registered, commands run unprivileged like before.
 */
export async function listGitTags(
  exec: RemoteExecSession,
  repositoryPath: string,
  gitCredentials?: GitFetchCredentials,
  sudoPassword?: string
): Promise<string[]> {
  const path = shellQuote(repositoryPath)
  const hints = [
    ...(sudoPassword !== undefined ? (['sudo'] as const) : []),
    ...(gitCredentials ? (['git'] as const) : [])
  ]
  const wrap = (command: string): string =>
    hints.length > 0
      ? wrapCommandForAuth(command, [...hints], {
          sudo: sudoPassword,
          gitUsername: gitCredentials?.username,
          gitPassword: gitCredentials?.password
        })
      : command

  const fetchCommand = `git -C ${path} fetch --tags --quiet`
  const fetchResult = await exec.exec(wrap(fetchCommand), { timeoutMs: 15_000 })
  if (fetchResult.exitCode !== 0) {
    throw toFriendlyError(fetchResult.stderr, gitCredentials, sudoPassword)
  }

  // `--sort=-creatordate` needs Git >= 2.19 — older Git on the remote (common
  // on legacy servers) rejects it with "unknown field name" or similar and
  // the tags would otherwise silently come back empty. Fall back to the
  // plain, unsorted `git tag` in that case rather than surfacing nothing.
  const sortedResult = await exec.exec(wrap(`git -C ${path} tag --sort=-creatordate`), {
    timeoutMs: 15_000
  })
  if (sortedResult.exitCode === 0) {
    return parseTagList(sortedResult.stdout)
  }
  if (!/unknown field name|unknown sort|invalid --sort/i.test(sortedResult.stderr)) {
    throw toFriendlyError(sortedResult.stderr, gitCredentials, sudoPassword)
  }
  const plainResult = await exec.exec(wrap(`git -C ${path} tag`), { timeoutMs: 15_000 })
  if (plainResult.exitCode !== 0) {
    throw toFriendlyError(plainResult.stderr, gitCredentials, sudoPassword)
  }
  return parseTagList(plainResult.stdout)
}

function parseTagList(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function toFriendlyError(
  stderr: string,
  gitCredentials: GitFetchCredentials | undefined,
  sudoPassword: string | undefined
): Error {
  const message = stderr.trim() || 'Não foi possível listar as tags do repositório'
  if (!gitCredentials && /could not read username|authentication failed/i.test(message)) {
    return new Error(`${message} — preencha "Usuário Git" e "Senha Git" em Secrets, na conexão`)
  }
  if (sudoPassword === undefined && /permission denied|dubious ownership/i.test(message)) {
    return new Error(`${message} — preencha "Senha sudo" em Secrets, na conexão`)
  }
  return new Error(message)
}
