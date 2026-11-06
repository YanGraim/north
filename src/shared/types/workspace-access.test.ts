import { describe, expect, it } from 'vitest'
import {
  FULL_ACCESS,
  permissionsFor,
  type WorkspaceAccess,
  WorkspaceAccessSchema
} from './workspace-access'

const path = { clientId: 'c1', environmentId: 'e1', groupId: 'g1' }

const member = (
  grants: WorkspaceAccess['grants'],
  connectionGrants: WorkspaceAccess['connectionGrants'] = [],
  accessGrants: WorkspaceAccess['accessGrants'] = []
): WorkspaceAccess => ({ role: 'member', grants, connectionGrants, accessGrants })

describe('permissionsFor', () => {
  it('a grant on one connection covers only that connection', () => {
    const conn = { ...path, connectionId: 'k1' }
    const viewer = permissionsFor(member([], [{ connectionId: 'k1', role: 'viewer' }]))
    expect(viewer.edit(conn)).toBe(false)
    expect(viewer.revealPassword(conn)).toBe(false)
    const editor = permissionsFor(member([], [{ connectionId: 'k1', role: 'editor' }]))
    expect(editor.edit(conn)).toBe(true)
    expect(editor.revealPassword(conn)).toBe(true)
    expect(editor.edit({ ...path, connectionId: 'k2' })).toBe(false)
    expect(editor.edit(path)).toBe(false)
  })

  it('a grant on one access covers only that access', () => {
    const db = { ...path, accessId: 'a1' }
    const editor = permissionsFor(member([], [], [{ accessId: 'a1', role: 'editor' }]))
    expect(editor.edit(db)).toBe(true)
    expect(editor.editsSomething).toBe(true)
    expect(editor.edit({ ...path, accessId: 'a2' })).toBe(false)
    const viewer = permissionsFor(member([], [], [{ accessId: 'a1', role: 'viewer' }]))
    expect(viewer.revealPassword(db)).toBe(false)
  })

  it('reads an older server answer without connection or access grants', () => {
    const parsed = WorkspaceAccessSchema.parse({ role: 'member', grants: [] })
    expect(parsed.connectionGrants).toEqual([])
    expect(parsed.accessGrants).toEqual([])
  })

  it('the personal workspace and admins can do everything', () => {
    for (const access of [
      FULL_ACCESS,
      { role: 'admin', grants: [], connectionGrants: [], accessGrants: [] } as WorkspaceAccess
    ]) {
      const can = permissionsFor(access)
      expect(can.createClient).toBe(true)
      expect(can.editsSomething).toBe(true)
      expect(can.edit(path)).toBe(true)
      expect(can.revealPassword(path)).toBe(true)
    }
  })

  it('a viewer only views, and never reads the password', () => {
    const can = permissionsFor(member([{ scopeType: 'client', scopeId: 'c1', role: 'viewer' }]))
    expect(can.createClient).toBe(false)
    expect(can.editsSomething).toBe(false)
    expect(can.edit(path)).toBe(false)
    expect(can.revealPassword(path)).toBe(false)
  })

  it('an editor grant flows down the tree, not up', () => {
    const can = permissionsFor(
      member([{ scopeType: 'environment', scopeId: 'e1', role: 'editor' }])
    )
    expect(can.edit(path)).toBe(true)
    expect(can.edit({ clientId: 'c1', environmentId: 'e1' })).toBe(true)
    expect(can.edit({ clientId: 'c1' })).toBe(false)
    expect(can.edit({ clientId: 'c1', environmentId: 'e2', groupId: 'g2' })).toBe(false)
    expect(can.editsSomething).toBe(true)
  })

  it('the strongest grant on the path wins', () => {
    const can = permissionsFor(
      member([
        { scopeType: 'client', scopeId: 'c1', role: 'viewer' },
        { scopeType: 'group', scopeId: 'g1', role: 'editor' }
      ])
    )
    expect(can.edit(path)).toBe(true)
    expect(can.edit({ clientId: 'c1', environmentId: 'e1' })).toBe(false)
  })

  it('an unknown path is read-only', () => {
    const can = permissionsFor(member([{ scopeType: 'group', scopeId: 'g1', role: 'editor' }]))
    expect(can.edit({ clientId: null, environmentId: null, groupId: null })).toBe(false)
  })
})
