import { describe, expect, it } from 'vitest'
import { FULL_ACCESS, permissionsFor, type WorkspaceAccess } from './workspace-access'

const path = { clientId: 'c1', environmentId: 'e1', groupId: 'g1' }

const member = (grants: WorkspaceAccess['grants']): WorkspaceAccess => ({ role: 'member', grants })

describe('permissionsFor', () => {
  it('the personal workspace and admins can do everything', () => {
    for (const access of [FULL_ACCESS, { role: 'admin', grants: [] } as WorkspaceAccess]) {
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
