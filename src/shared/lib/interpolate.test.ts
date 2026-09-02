import { describe, expect, it } from 'vitest'
import { buildRunVariables, interpolate, interpolateDeep } from './interpolate'

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
