import { describe, expect, it } from 'vitest'
import {
  LOCAL_WORKSPACE_ID,
  parseWorkspacePath,
  stripWorkspacePrefix,
  toLegacyRedirect,
  workspacePath
} from './workspace-paths'

describe('workspacePath', () => {
  it('prefixes an absolute path with the workspace', () => {
    expect(workspacePath('local', '/connections')).toBe('/w/local/connections')
  })

  it('keeps query string and hash', () => {
    expect(workspacePath('local', '/connections?connection=abc#x')).toBe(
      '/w/local/connections?connection=abc#x'
    )
    expect(workspacePath('acme', '/settings#profile')).toBe('/w/acme/settings#profile')
  })

  it('accepts paths without a leading slash', () => {
    expect(workspacePath('local', 'history')).toBe('/w/local/history')
  })

  it('maps the root to the workspace dashboard', () => {
    expect(workspacePath('local', '/')).toBe('/w/local/dashboard')
    expect(workspacePath('local', '')).toBe('/w/local/dashboard')
  })

  it('does not double-prefix a path that is already scoped', () => {
    expect(workspacePath('local', '/w/acme/history')).toBe('/w/acme/history')
  })

  it('encodes the workspace id', () => {
    expect(workspacePath('a b', '/x')).toBe('/w/a%20b/x')
  })
})

describe('parseWorkspacePath', () => {
  it('extracts the workspace and the inner path', () => {
    expect(parseWorkspacePath('/w/local/clients/1')).toEqual({
      workspaceId: 'local',
      innerPath: '/clients/1'
    })
  })

  it('treats a bare workspace as its root', () => {
    expect(parseWorkspacePath('/w/acme')).toEqual({ workspaceId: 'acme', innerPath: '/' })
    expect(parseWorkspacePath('/w/acme/')).toEqual({ workspaceId: 'acme', innerPath: '/' })
  })

  it('returns null for unscoped paths', () => {
    expect(parseWorkspacePath('/connections')).toBeNull()
    expect(parseWorkspacePath('/')).toBeNull()
    expect(parseWorkspacePath('/w')).toBeNull()
    expect(parseWorkspacePath('/wx/local')).toBeNull()
  })
})

describe('stripWorkspacePrefix', () => {
  it('removes the prefix and leaves unscoped paths alone', () => {
    expect(stripWorkspacePrefix('/w/local/history')).toBe('/history')
    expect(stripWorkspacePrefix('/history')).toBe('/history')
  })
})

describe('toLegacyRedirect', () => {
  it('moves a legacy path into the preferred workspace', () => {
    expect(toLegacyRedirect('/connections', '?connection=1', 'acme')).toBe(
      '/w/acme/connections?connection=1'
    )
  })

  it('falls back to the local workspace', () => {
    expect(toLegacyRedirect('/history', '', null)).toBe(`/w/${LOCAL_WORKSPACE_ID}/history`)
  })

  it('sends the root to the dashboard', () => {
    expect(toLegacyRedirect('/', '', null)).toBe('/w/local/dashboard')
  })

  it('maps the old /help alias to the manual', () => {
    expect(toLegacyRedirect('/help', '', null)).toBe('/w/local/settings/manual')
  })
})
