import { describe, expect, it } from 'vitest'
import { LOCAL_WORKSPACE_ID, WorkspaceIdSchema, WorkspaceSchema } from './workspace'

describe('workspace schema', () => {
  it('accepts the built-in local workspace', () => {
    const parsed = WorkspaceSchema.parse({
      id: LOCAL_WORKSPACE_ID,
      name: 'Pessoal',
      kind: 'local',
      serverUrl: null,
      createdAt: '2026-10-20T00:00:00.000Z'
    })
    expect(parsed.kind).toBe('local')
  })

  it('accepts an organization workspace with an https server url', () => {
    const parsed = WorkspaceSchema.parse({
      id: 'acme',
      name: 'Acme',
      kind: 'organization',
      serverUrl: 'https://north.acme.com',
      createdAt: '2026-10-20T00:00:00.000Z'
    })
    expect(parsed.serverUrl).toBe('https://north.acme.com')
  })

  it('rejects an organization without a server url', () => {
    expect(() =>
      WorkspaceSchema.parse({
        id: 'acme',
        name: 'Acme',
        kind: 'organization',
        serverUrl: null,
        createdAt: '2026-10-20T00:00:00.000Z'
      })
    ).toThrow()
  })

  it('rejects an unknown kind', () => {
    expect(() =>
      WorkspaceSchema.parse({
        id: 'x',
        name: 'X',
        kind: 'cloud',
        serverUrl: null,
        createdAt: '2026-10-20T00:00:00.000Z'
      })
    ).toThrow()
  })

  it.each(['local', 'acme', '3f1c2b9e-1111-4222-8333-444455556666'])(
    'accepts %s as a workspace id',
    (id) => {
      expect(WorkspaceIdSchema.parse(id)).toBe(id)
    }
  )

  it.each(['', 'has space', '../etc', 'a/b', 'Upper'])('rejects %j as a workspace id', (id) => {
    expect(() => WorkspaceIdSchema.parse(id)).toThrow()
  })
})
