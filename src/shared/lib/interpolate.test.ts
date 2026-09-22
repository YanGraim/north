import { describe, expect, it } from 'vitest'
import {
  buildRunVariables,
  interpolate,
  interpolateDeep,
  interpolateShellSafe
} from './interpolate'

describe('interpolate', () => {
  it('replaces {{KEY}} placeholders', () => {
    expect(interpolate('cd {{PROJECT_PATH}} && ls', { PROJECT_PATH: '/var/www' })).toBe(
      'cd /var/www && ls'
    )
  })

  it('leaves unknown keys untouched', () => {
    expect(interpolate('echo {{MISSING}}', {})).toBe('echo {{MISSING}}')
  })

  it('applies precedence group → defaults → inputs → set.variable', () => {
    const ctx = buildRunVariables({
      groupVariables: { A: 'group', B: 'group', C: 'group' },
      inputDefaults: { B: 'default', C: 'default', D: 'default' },
      inputValues: { C: 'input', E: true },
      runVariables: { D: 'runtime' }
    })
    expect(ctx).toEqual({
      A: 'group',
      B: 'default',
      C: 'input',
      D: 'runtime',
      E: 'true'
    })
  })

  it('interpolates nested config objects', () => {
    const result = interpolateDeep(
      { command: 'cd {{PATH}}', nested: { x: '{{X}}' } },
      { PATH: '/tmp', X: '1' }
    )
    expect(result).toEqual({ command: 'cd /tmp', nested: { x: '1' } })
  })
})

describe('interpolateShellSafe', () => {
  it('quotes a substituted value while leaving template shell syntax untouched', () => {
    expect(interpolateShellSafe('git checkout {{TAG}}', { TAG: 'prod-ecofitus-4.9.002' })).toBe(
      "git checkout 'prod-ecofitus-4.9.002'"
    )
  })

  it('neutralizes shell metacharacters inside a substituted value', () => {
    const result = interpolateShellSafe('git checkout {{TAG}}', {
      TAG: '$(rm -rf /); echo pwned'
    })
    expect(result).toBe("git checkout '$(rm -rf /); echo pwned'")
  })

  it('leaves unknown keys untouched, unquoted', () => {
    expect(interpolateShellSafe('echo {{MISSING}}', {})).toBe('echo {{MISSING}}')
  })

  it('quotes multiple placeholders independently', () => {
    expect(
      interpolateShellSafe('cd {{PATH}} && git checkout {{TAG}}', {
        PATH: '/var/www/html/wms-app',
        TAG: 'v1'
      })
    ).toBe("cd '/var/www/html/wms-app' && git checkout 'v1'")
  })
})
