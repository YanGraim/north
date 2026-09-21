import { describe, expect, it, vi } from 'vitest'
import { GitTrackingService } from './git-tracking-service'
import type { RemoteExecSession } from './remote-exec-service'

function fakeExec(
  responses: Record<string, { exitCode: number; stdout: string; stderr?: string }>
): RemoteExecSession {
  return {
    exec: vi.fn(async (command: string) => {
      for (const [match, result] of Object.entries(responses)) {
        if (command.includes(match)) {
          return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' }
        }
      }
      throw new Error(`Unexpected command: ${command}`)
    }),
    dispose: vi.fn(async () => undefined)
  }
}

const tracking = { type: 'git-update' as const, repositoryPath: '/var/www/html/wms-api' }

describe('GitTrackingService.captureBefore', () => {
  it('reads HEAD commit and current branch', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'a1b2c3d\n' },
      'branch --show-current': { exitCode: 0, stdout: 'release\n' }
    })

    const snapshot = await new GitTrackingService().captureBefore(exec, tracking)
    expect(snapshot).toEqual({ commit: 'a1b2c3d', branch: 'release' })
  })

  it('uses tracking.branch override instead of detecting it', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'a1b2c3d\n' }
    })
    // no 'branch --show-current' entry — would throw "Unexpected command" if called
    const snapshot = await new GitTrackingService().captureBefore(exec, {
      ...tracking,
      branch: 'main'
    })
    expect(snapshot).toEqual({ commit: 'a1b2c3d', branch: 'main' })
  })

  it('returns null when the path is not a git repo', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }
    })
    expect(await new GitTrackingService().captureBefore(exec, tracking)).toBeNull()
  })

  it('returns null when exec throws', async () => {
    const exec: RemoteExecSession = {
      exec: vi.fn(async () => {
        throw new Error('ssh channel closed')
      }),
      dispose: vi.fn(async () => undefined)
    }
    expect(await new GitTrackingService().captureBefore(exec, tracking)).toBeNull()
  })

  it('falls back to empty branch on detached HEAD (no override, empty output)', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'a1b2c3d\n' },
      'branch --show-current': { exitCode: 0, stdout: '\n' }
    })
    const snapshot = await new GitTrackingService().captureBefore(exec, tracking)
    expect(snapshot).toEqual({ commit: 'a1b2c3d', branch: '' })
  })
})

describe('GitTrackingService.captureAfter', () => {
  const before = { commit: 'a1b2c3d', branch: 'release' }

  it('returns null when the commit did not change (no-op update)', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'a1b2c3d\n' }
    })
    expect(await new GitTrackingService().captureAfter(exec, tracking, before)).toBeNull()
  })

  it('parses a single-commit range', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'f91ab42\n' },
      'log --oneline': { exitCode: 0, stdout: 'f91ab42 fix: conference issue\n' },
      'diff --name-only': { exitCode: 0, stdout: 'app/Http/Controllers/Conf.php\n' }
    })
    const delta = await new GitTrackingService().captureAfter(exec, tracking, before)
    expect(delta).toEqual({
      currentCommit: 'f91ab42',
      commits: [{ hash: 'f91ab42', message: 'fix: conference issue' }],
      filesChanged: 1
    })
  })

  it('parses multiple commits including a merge commit message', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'f91ab42\n' },
      'log --oneline': {
        exitCode: 0,
        stdout: [
          "f91ab42 Merge branch 'feature/report' into release",
          'a82f31c fix: integration',
          '72bd901 feat: report'
        ].join('\n')
      },
      'diff --name-only': {
        exitCode: 0,
        stdout: 'a.php\nb.php\nc.php\n'
      }
    })
    const delta = await new GitTrackingService().captureAfter(exec, tracking, before)
    expect(delta?.commits).toHaveLength(3)
    expect(delta?.commits[0]).toEqual({
      hash: 'f91ab42',
      message: "Merge branch 'feature/report' into release"
    })
    expect(delta?.filesChanged).toBe(3)
  })

  it('handles an empty commit range gracefully', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'f91ab42\n' },
      'log --oneline': { exitCode: 0, stdout: '' },
      'diff --name-only': { exitCode: 0, stdout: '' }
    })
    const delta = await new GitTrackingService().captureAfter(exec, tracking, before)
    expect(delta).toEqual({ currentCommit: 'f91ab42', commits: [], filesChanged: 0 })
  })

  it('ignores a trailing blank line in diff --name-only output', async () => {
    const exec = fakeExec({
      'rev-parse HEAD': { exitCode: 0, stdout: 'f91ab42\n' },
      'log --oneline': { exitCode: 0, stdout: 'f91ab42 chore\n' },
      'diff --name-only': { exitCode: 0, stdout: 'a.php\nb.php\n\n' }
    })
    const delta = await new GitTrackingService().captureAfter(exec, tracking, before)
    expect(delta?.filesChanged).toBe(2)
  })

  it('returns null when exec throws mid-capture', async () => {
    const exec: RemoteExecSession = {
      exec: vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'f91ab42\n', stderr: '' })
        .mockRejectedValueOnce(new Error('channel closed')),
      dispose: vi.fn(async () => undefined)
    }
    expect(await new GitTrackingService().captureAfter(exec, tracking, before)).toBeNull()
  })
})
