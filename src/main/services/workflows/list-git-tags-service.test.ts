import { describe, expect, it, vi } from 'vitest'
import { listGitTags } from './list-git-tags-service'
import type { RemoteExecSession } from './remote-exec-service'

function fakeExec(result: { exitCode: number; stdout: string; stderr?: string }): {
  exec: RemoteExecSession
  calls: string[]
} {
  const calls: string[] = []
  return {
    exec: {
      exec: vi.fn(async (command: string) => {
        calls.push(command)
        return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' }
      }),
      dispose: vi.fn(async () => undefined)
    },
    calls
  }
}

describe('listGitTags', () => {
  it('fetches tags and lists them, newest first, one per line', async () => {
    const { exec, calls } = fakeExec({
      exitCode: 0,
      stdout: 'prod-ecofitus-4.9.002\nprod-ecofitus-4.9.001\nprod-ecofitus-4.8.000\n'
    })

    const tags = await listGitTags(exec, '/var/www/html/wms-app')

    expect(tags).toEqual([
      'prod-ecofitus-4.9.002',
      'prod-ecofitus-4.9.001',
      'prod-ecofitus-4.8.000'
    ])
    expect(calls[0]).toBe(
      "git -C '/var/www/html/wms-app' fetch --tags --quiet && git -C '/var/www/html/wms-app' tag --sort=-creatordate"
    )
  })

  it('returns an empty array when the repo has no tags', async () => {
    const { exec } = fakeExec({ exitCode: 0, stdout: '\n' })
    expect(await listGitTags(exec, '/repo')).toEqual([])
  })

  it('throws with the stderr message when the exec fails', async () => {
    const { exec } = fakeExec({
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository'
    })
    await expect(listGitTags(exec, '/not-a-repo')).rejects.toThrow('fatal: not a git repository')
  })

  it('shell-quotes the repository path', async () => {
    const { exec, calls } = fakeExec({ exitCode: 0, stdout: 'v1\n' })
    await listGitTags(exec, "/tmp/it's a repo")
    expect(calls[0]).toContain(String.raw`'/tmp/it'\''s a repo'`)
  })

  it('wraps the fetch with askpass credentials when given git credentials', async () => {
    const { exec, calls } = fakeExec({ exitCode: 0, stdout: 'v1\n' })
    await listGitTags(exec, '/repo', { username: 'deploy-bot', password: 's3cret' })
    expect(calls[0]).toContain('GIT_ASKPASS=')
    expect(calls[0]).toContain('GIT_TERMINAL_PROMPT=0')
    expect(calls[0]).toContain("-C '/repo' fetch --tags --quiet")
    expect(calls[0]).toContain('insteadOf')
  })

  it('does not wrap the command when no git credentials are given', async () => {
    const { exec, calls } = fakeExec({ exitCode: 0, stdout: 'v1\n' })
    await listGitTags(exec, '/repo')
    expect(calls[0]).not.toContain('GIT_ASKPASS')
  })

  it('hints at Secrets when an HTTPS remote asks for auth and no credentials were given', async () => {
    const { exec } = fakeExec({
      exitCode: 128,
      stdout: '',
      stderr:
        "fatal: could not read Username for 'https://bitbucket.org': No such device or address"
    })
    await expect(listGitTags(exec, '/repo')).rejects.toThrow(/Usuário Git.*Senha Git/)
  })

  it('does not add the Secrets hint when credentials were already provided and still failed', async () => {
    const { exec } = fakeExec({
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: Authentication failed'
    })
    await expect(
      listGitTags(exec, '/repo', { username: 'deploy-bot', password: 'wrong' })
    ).rejects.toThrow('fatal: Authentication failed')
  })
})
