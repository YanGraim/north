import { describe, expect, it } from 'vitest'
import {
  ASKPASS_PLACEHOLDER,
  escapeForDoubleQuotes,
  gitConfigAuthFlags,
  injectGitAuthIntoCommand,
  remoteDoubleQuotedWithAskpass,
  shellSingleQuote,
  wrapCommandForAuth,
  wrapWithGitAskpass,
  wrapWithSudo
} from './auth-wrap'

const USER_CMD =
  'cd /var/www/html/wms-app && sudo git pull && sudo docker compose -f docker-compose.prod.yml up --build -d'

describe('auth-wrap', () => {
  it('shellSingleQuote escapes embedded single quotes', () => {
    expect(shellSingleQuote(`a'b`)).toBe(`'a'\\''b'`)
  })

  it('escapeForDoubleQuotes escapes shell-sensitive chars', () => {
    expect(escapeForDoubleQuotes(`a"$\\\`b`)).toBe(`a\\"\\$\\\\\\\`b`)
  })

  it('injectGitAuthIntoCommand puts GIT_ASKPASS on the sudo command line', () => {
    const injected = injectGitAuthIntoCommand(USER_CMD, 'alice', 'p@ss')
    expect(injected).toContain(
      `sudo GIT_ASKPASS=${ASKPASS_PLACEHOLDER} GIT_TERMINAL_PROMPT=0 DISPLAY= git`
    )
    expect(injected).toContain('bitbucket.org')
    expect(injected).toContain('.insteadOf=')
    expect(injected).toContain('sudo docker compose')
    expect(injected).not.toMatch(/sudo docker.*GIT_ASKPASS/)
    // Must NOT be env-before-sudo (that gets cleared):
    expect(injected).not.toMatch(/GIT_ASKPASS=\S+ sudo git/)
  })

  it('remoteDoubleQuotedWithAskpass expands $ASKPASS between parts', () => {
    const script = `sudo GIT_ASKPASS=${ASKPASS_PLACEHOLDER} git pull`
    expect(remoteDoubleQuotedWithAskpass(script)).toBe(`"sudo GIT_ASKPASS="$ASKPASS" git pull"`)
  })

  it('gitConfigAuthFlags embeds insteadOf and Basic header', () => {
    const flags = gitConfigAuthFlags('alice', 'p@ss')
    expect(flags).toContain('bitbucket.org')
    expect(flags).toContain(Buffer.from('alice:p@ss', 'utf8').toString('base64'))
  })

  it('wrapWithGitAskpass builds askpass + runner for the wms-app command', () => {
    const wrapped = wrapWithGitAskpass(USER_CMD, 'alice', 'p@ss')
    expect(wrapped).toContain('ASKPASS=$(mktemp)')
    expect(wrapped).toContain('NORTH_RUN=$(mktemp)')
    expect(wrapped).toContain('$ASKPASS')
    expect(wrapped).toContain('sudo GIT_ASKPASS=')
    expect(wrapped).toContain('bash "$NORTH_RUN"')
    expect(wrapped).toContain('rm -f "$ASKPASS"')
  })

  it('wrapWithSudo writes a runner and pipes password to sudo -S', () => {
    const wrapped = wrapWithSudo('systemctl restart nginx', 's3cret')
    expect(wrapped).toContain('NORTH_RUN=$(mktemp)')
    expect(wrapped).toContain('sudo -S')
    expect(wrapped).toContain(`'s3cret'`)
  })

  it('wrapCommandForAuth with git+sudo uses sudo -S on the runner', () => {
    const wrapped = wrapCommandForAuth(USER_CMD, ['git', 'sudo'], {
      gitUsername: 'u',
      gitPassword: 'gp',
      sudo: 'sp'
    })
    expect(wrapped).toContain('sudo -S')
    expect(wrapped).toContain('bash "$NORTH_RUN"')
    expect(wrapped).toContain('sudo GIT_ASKPASS=')
  })

  it('wrapCommandForAuth with empty hints returns raw command', () => {
    expect(wrapCommandForAuth('echo hi', [], { sudo: 'x' })).toBe('echo hi')
  })
})
