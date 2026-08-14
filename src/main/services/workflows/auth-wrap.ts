import { Buffer } from 'node:buffer'
import type { AuthHint } from '@shared/types'

export type AuthCredentials = {
  sudo?: string
  gitUsername?: string
  gitPassword?: string
}

const GIT_HTTPS_HOSTS = ['bitbucket.org', 'github.com', 'gitlab.com'] as const
export const ASKPASS_PLACEHOLDER = '__NORTH_ASKPASS__'

/** POSIX single-quote escape for embedding values in remote shell commands. */
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Escape for double-quoted remote shell words. */
export function escapeForDoubleQuotes(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
}

/**
 * Produce `"part"$ASKPASS"part"` so the writer shell expands $ASKPASS into the runner file.
 */
export function remoteDoubleQuotedWithAskpass(script: string): string {
  return script
    .split(ASKPASS_PLACEHOLDER)
    .map((part) => `"${escapeForDoubleQuotes(part)}"`)
    .join('$ASKPASS')
}

/** url.insteadOf + Basic header flags (no TTY). */
export function gitConfigAuthFlags(username: string, password: string): string {
  const basic = Buffer.from(`${username}:${password}`, 'utf8').toString('base64')
  const userinfo = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
  const insteadFlags = GIT_HTTPS_HOSTS.map((host) => {
    const assignment = `url.https://${userinfo}@${host}/.insteadOf=https://${host}/`
    return `-c ${shellSingleQuote(assignment)}`
  }).join(' ')
  const header = shellSingleQuote(`Authorization: Basic ${basic}`)
  return `-c credential.helper= ${insteadFlags} -c http.extraHeader=${header}`
}

/**
 * Rewrite `sudo git` / `git` so credentials survive sudo.
 *
 * Critical: `sudo` clears env — must use `sudo GIT_ASKPASS=… git`, not env before sudo.
 */
export function injectGitAuthIntoCommand(
  command: string,
  username: string,
  password: string
): string {
  const configFlags = gitConfigAuthFlags(username, password)
  const sudoGit = `sudo GIT_ASKPASS=${ASKPASS_PLACEHOLDER} GIT_TERMINAL_PROMPT=0 DISPLAY= git ${configFlags}`
  const bareGit = `GIT_ASKPASS=${ASKPASS_PLACEHOLDER} GIT_TERMINAL_PROMPT=0 DISPLAY= git ${configFlags}`

  return command.replace(/(^|[\s;|&])(?:sudo\s+)?git\b/g, (match, prefix: string) => {
    const withSudo = /sudo\s+git/.test(match)
    return `${prefix}${withSudo ? sudoGit : bareGit}`
  })
}

function writeAskpassScript(username: string, password: string): string[] {
  const userQ = shellSingleQuote(username)
  const passQ = shellSingleQuote(password)
  const lines = [
    '#!/bin/sh',
    'case "$1" in',
    `*[Uu]sername*) echo ${userQ} ;;`,
    `*) echo ${passQ} ;;`,
    'esac'
  ]
  const printfArgs = lines.map((line) => shellSingleQuote(line)).join(' ')
  return ['ASKPASS=$(mktemp)', `printf '%s\\n' ${printfArgs} > "$ASKPASS"`, 'chmod 700 "$ASKPASS"']
}

/**
 * Wrap a remote command for optional Git / Sudo auth.
 *
 * For `cd … && sudo git pull && sudo docker …` with Git checked:
 * askpass file + `sudo GIT_ASKPASS=… git -c url.insteadOf=…` (env on the sudo command line).
 */
export function wrapCommandForAuth(
  command: string,
  hints: AuthHint[],
  creds: AuthCredentials
): string {
  if (hints.length === 0) return command

  const wantGit = hints.includes('git') && creds.gitPassword !== undefined
  const wantSudo = hints.includes('sudo') && creds.sudo !== undefined

  let userCmd = command
  if (wantGit) {
    userCmd = injectGitAuthIntoCommand(
      command,
      creds.gitUsername ?? '',
      creds.gitPassword as string
    )
  }

  const lines: string[] = []

  if (wantGit) {
    lines.push(...writeAskpassScript(creds.gitUsername ?? '', creds.gitPassword as string))
  }

  lines.push('NORTH_RUN=$(mktemp)')
  lines.push(`printf '%s\\n' 'export GIT_TERMINAL_PROMPT=0' > "$NORTH_RUN"`)

  if (wantGit) {
    lines.push(`printf '%s\\n' ${remoteDoubleQuotedWithAskpass(userCmd)} >> "$NORTH_RUN"`)
  } else {
    lines.push(`printf '%s\\n' "${escapeForDoubleQuotes(userCmd)}" >> "$NORTH_RUN"`)
  }

  lines.push('chmod 700 "$NORTH_RUN"')

  if (wantSudo) {
    lines.push(
      `printf '%s\\n' ${shellSingleQuote(creds.sudo as string)} | sudo -S -p '' -- bash "$NORTH_RUN"`
    )
  } else {
    lines.push('bash "$NORTH_RUN"')
  }

  lines.push('rm -f "$NORTH_RUN"')
  if (wantGit) {
    lines.push('rm -f "$ASKPASS"')
  }

  return lines.join('; ')
}

/** @deprecated */
export function wrapWithGitAskpass(command: string, username: string, password: string): string {
  return wrapCommandForAuth(command, ['git'], { gitUsername: username, gitPassword: password })
}

/** @deprecated */
export function wrapWithSudo(command: string, password: string): string {
  return wrapCommandForAuth(command, ['sudo'], { sudo: password })
}

/** @deprecated */
export function injectGitCredentialFlags(
  command: string,
  username: string,
  password: string
): string {
  return injectGitAuthIntoCommand(command, username, password)
}

/** @deprecated */
export function gitAuthFlags(username: string, password: string): string {
  return gitConfigAuthFlags(username, password)
}
