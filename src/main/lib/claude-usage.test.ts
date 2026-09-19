import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudeProjectSlug,
  cwdForPid,
  findActiveClaudeSessionFile,
  findClaudeDescendantPid,
  readLatestClaudeUsage
} from './claude-usage'

describe('claudeProjectSlug', () => {
  it('replaces slashes and dots with dashes, matching Claude Code project folders', () => {
    expect(claudeProjectSlug('/Users/yan/dev/north')).toBe('-Users-yan-dev-north')
    expect(claudeProjectSlug('/Users/yan/dev/north/.north/worktrees/feature-x')).toBe(
      '-Users-yan-dev-north--north-worktrees-feature-x'
    )
  })
})

describe('findActiveClaudeSessionFile / readLatestClaudeUsage', () => {
  let home: string
  let cwd: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'north-claude-home-'))
    cwd = '/repo/worktree'
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
  })

  function projectDir(): string {
    return join(home, '.claude', 'projects', claudeProjectSlug(cwd))
  }

  it('returns null when the project folder does not exist', () => {
    expect(findActiveClaudeSessionFile(cwd, 0, home)).toBeNull()
  })

  it('picks the newest transcript modified at/after sinceMs', async () => {
    const dir = projectDir()
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'old.jsonl'), '{}')
    const since = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 10))
    writeFileSync(join(dir, 'new.jsonl'), '{}')

    const found = findActiveClaudeSessionFile(cwd, since, home)
    expect(found).toBe(join(dir, 'new.jsonl'))
  })

  it('reads the last usage block, summing input + cache tokens', () => {
    const dir = projectDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'session.jsonl')
    const lines = [
      JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 2 } } }),
      JSON.stringify({ type: 'user' }),
      JSON.stringify({
        type: 'assistant',
        message: {
          usage: {
            input_tokens: 3,
            cache_read_input_tokens: 1000,
            cache_creation_input_tokens: 50,
            output_tokens: 20
          }
        }
      })
    ]
    writeFileSync(file, `${lines.join('\n')}\n`)

    const usage = readLatestClaudeUsage(file)
    expect(usage?.totalTokens).toBe(1053)
    expect(usage?.percentOfWindow).toBe(0)
    expect(usage?.contextWindow).toBe(1_000_000)
    expect(usage?.inputTokens).toBe(3)
    expect(usage?.cacheReadTokens).toBe(1000)
    expect(usage?.cacheCreationTokens).toBe(50)
    expect(usage?.outputTokens).toBe(20)
  })

  it('returns null for a missing file or a transcript with no usage block', () => {
    expect(readLatestClaudeUsage('/does/not/exist.jsonl')).toBeNull()

    const dir = projectDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'no-usage.jsonl')
    writeFileSync(file, `${JSON.stringify({ type: 'user' })}\n`)
    expect(readLatestClaudeUsage(file)).toBeNull()
  })
})

describe('findClaudeDescendantPid', () => {
  const psOutput = [
    '  PID  PPID COMM',
    '    1     0 /sbin/launchd',
    '  100     1 /bin/zsh',
    '  200   100 /opt/homebrew/bin/claude',
    '  300     1 /bin/zsh'
  ].join('\n')

  it('finds a claude process nested under the given root pid', async () => {
    const execFile = async () => ({ stdout: psOutput, stderr: '' })
    const pid = await findClaudeDescendantPid(100, { execFile: execFile as never })
    expect(pid).toBe(200)
  })

  it('returns null when no claude process descends from the root pid', async () => {
    const execFile = async () => ({ stdout: psOutput, stderr: '' })
    const pid = await findClaudeDescendantPid(300, { execFile: execFile as never })
    expect(pid).toBeNull()
  })

  it('matches when the root pid itself is claude (zsh -c exec, no fork)', async () => {
    const execFile = async () => ({
      stdout: ['  PID  PPID COMM', '  400     1 claude'].join('\n'),
      stderr: ''
    })
    const pid = await findClaudeDescendantPid(400, { execFile: execFile as never })
    expect(pid).toBe(400)
  })

  it('returns null when `ps` fails', async () => {
    const execFile = async () => {
      throw new Error('no ps')
    }
    const pid = await findClaudeDescendantPid(100, { execFile: execFile as never })
    expect(pid).toBeNull()
  })
})

describe('cwdForPid', () => {
  it('parses the cwd from `lsof -Fn` output on macOS', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    try {
      const execFile = async () => ({ stdout: 'p200\nn/Users/yan/dev/project\n', stderr: '' })
      const cwd = await cwdForPid(200, { execFile: execFile as never })
      expect(cwd).toBe('/Users/yan/dev/project')
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    }
  })

  it('reads the cwd via /proc on Linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })
    try {
      const readlinkFn = async () => '/home/yan/project'
      const cwd = await cwdForPid(200, { readlink: readlinkFn as never })
      expect(cwd).toBe('/home/yan/project')
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    }
  })

  it('returns null on Windows', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      expect(await cwdForPid(200)).toBeNull()
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    }
  })
})
