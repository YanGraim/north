import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'

describe('AgentWorkspacesRepository', () => {
  it('CRUDs a workspace independent of any client/group', () => {
    const { repos } = createTestRepositories()
    const column = repos.agentBoardColumns.create({ name: 'Backlog' })

    const workspace = repos.agentWorkspaces.create({
      repoPath: '/repo',
      repoName: 'repo',
      worktreePath: '/repo/.north/worktrees/feature-x',
      branch: 'feature-x',
      agentCommand: 'claude',
      taskNote: 'Add dark mode',
      columnId: column.id
    })

    expect(workspace.columnId).toBe(column.id)
    expect(repos.agentWorkspaces.list()).toHaveLength(1)
    expect(repos.agentWorkspaces.get(workspace.id)?.branch).toBe('feature-x')

    const otherColumn = repos.agentBoardColumns.create({ name: 'Concluído' })
    const updated = repos.agentWorkspaces.update(workspace.id, { columnId: otherColumn.id })
    expect(updated?.columnId).toBe(otherColumn.id)
    expect(updated?.taskNote).toBe('Add dark mode')

    expect(repos.agentWorkspaces.update('missing-id', { columnId: null })).toBeNull()

    expect(repos.agentWorkspaces.delete(workspace.id)).toBe(true)
    expect(repos.agentWorkspaces.get(workspace.id)).toBeNull()
  })

  it('sets column_id to null when its column is deleted', () => {
    const { repos } = createTestRepositories()
    const column = repos.agentBoardColumns.create({ name: 'Backlog' })
    const workspace = repos.agentWorkspaces.create({
      repoPath: '/repo',
      repoName: 'repo',
      worktreePath: '/repo/.north/worktrees/feature-y',
      branch: 'feature-y',
      agentCommand: 'claude',
      taskNote: null,
      columnId: column.id
    })

    repos.agentBoardColumns.delete(column.id)

    expect(repos.agentWorkspaces.get(workspace.id)?.columnId).toBeNull()
  })
})

describe('AgentBoardColumnsRepository', () => {
  it('seeds the default columns via migration 012', () => {
    const { repos } = createTestRepositories()
    expect(repos.agentBoardColumns.list().map((c) => c.name)).toEqual([
      'Backlog',
      'Em andamento',
      'Concluído'
    ])
  })

  it('CRUDs columns, auto-incrementing sort order after the seeded ones', () => {
    const { repos } = createTestRepositories()
    const seeded = repos.agentBoardColumns.list().length

    const custom = repos.agentBoardColumns.create({ name: 'Revisão' })
    expect(custom.sortOrder).toBe(seeded)

    expect(repos.agentBoardColumns.list()).toHaveLength(seeded + 1)

    const renamed = repos.agentBoardColumns.update(custom.id, { name: 'Em revisão' })
    expect(renamed?.name).toBe('Em revisão')

    expect(repos.agentBoardColumns.delete(custom.id)).toBe(true)
    expect(repos.agentBoardColumns.list()).toHaveLength(seeded)
  })
})
