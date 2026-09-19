import { describe, expect, it, vi } from 'vitest'
import {
  addWorktree,
  removeWorktree,
  repoNameFromPath,
  sanitizeBranchForPath,
  worktreePathFor
} from './git-worktree'

describe('sanitizeBranchForPath', () => {
  it('replaces unsafe characters with dashes', () => {
    expect(sanitizeBranchForPath('feature/agent-manager')).toBe('feature-agent-manager')
    expect(sanitizeBranchForPath('fix bug #123')).toBe('fix-bug-123')
  })

  it('falls back to "branch" for an empty/fully-unsafe name', () => {
    expect(sanitizeBranchForPath('   ')).toBe('branch')
    expect(sanitizeBranchForPath('///')).toBe('branch')
  })
})

describe('repoNameFromPath', () => {
  it('takes the last path segment, ignoring a trailing slash', () => {
    expect(repoNameFromPath('/Users/yan/dev/north')).toBe('north')
    expect(repoNameFromPath('/Users/yan/dev/north/')).toBe('north')
  })
})

describe('worktreePathFor', () => {
  it('nests under .north/worktrees/<sanitized-branch>', () => {
    expect(worktreePathFor('/repo', 'feature/x')).toBe('/repo/.north/worktrees/feature-x')
  })
})

describe('addWorktree', () => {
  it('creates a new branch (-b) when the branch does not exist yet', async () => {
    const execFile = vi.fn().mockImplementation((_file, args: readonly string[]) => {
      if (args[0] === 'rev-parse') return Promise.reject(new Error('unknown ref'))
      return Promise.resolve({ stdout: '', stderr: '' })
    })

    await addWorktree('/repo', 'feature-x', '/repo/.north/worktrees/feature-x', { execFile })

    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['worktree', 'add', '/repo/.north/worktrees/feature-x', '-b', 'feature-x'],
      { cwd: '/repo' }
    )
  })

  it('checks out the existing branch (no -b) when it already exists', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })

    await addWorktree('/repo', 'main', '/repo/.north/worktrees/main', { execFile })

    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['worktree', 'add', '/repo/.north/worktrees/main', 'main'],
      { cwd: '/repo' }
    )
  })

  it('wraps failures with a clear message instead of swallowing them', async () => {
    const execFile = vi.fn().mockImplementation((_file, args: readonly string[]) => {
      if (args[0] === 'rev-parse') return Promise.reject(new Error('unknown ref'))
      return Promise.reject(new Error('branch already exists'))
    })

    await expect(
      addWorktree('/repo', 'main', '/repo/.north/worktrees/main', { execFile })
    ).rejects.toThrow(/Não foi possível criar a worktree/)
  })

  it('gives a friendly explanation when the branch is checked out elsewhere', async () => {
    const execFile = vi.fn().mockImplementation((_file, args: readonly string[]) => {
      if (args[0] === 'rev-parse') return Promise.resolve({ stdout: '', stderr: '' })
      return Promise.reject(
        new Error(`fatal: 'main' is already used by worktree at '/Users/yan/dev/north'`)
      )
    })

    await expect(
      addWorktree('/repo', 'main', '/repo/.north/worktrees/main', { execFile })
    ).rejects.toThrow(/já está em uso em outra pasta de trabalho \(\/Users\/yan\/dev\/north\)/)
  })
})

describe('removeWorktree', () => {
  it('runs git worktree remove <path> without --force', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })

    await removeWorktree('/repo', '/repo/.north/worktrees/feature-x', { execFile })

    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['worktree', 'remove', '/repo/.north/worktrees/feature-x'],
      { cwd: '/repo' }
    )
  })

  it('surfaces the error instead of forcing removal on a dirty worktree', async () => {
    const execFile = vi.fn().mockRejectedValue(new Error('worktree has uncommitted changes'))

    await expect(
      removeWorktree('/repo', '/repo/.north/worktrees/feature-x', { execFile })
    ).rejects.toThrow(/Não foi possível remover a worktree/)
  })
})
