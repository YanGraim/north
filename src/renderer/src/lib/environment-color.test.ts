import { describe, expect, it } from 'vitest'
import {
  defaultEnvironmentColor,
  environmentBadgeLabel,
  environmentContextMessage,
  environmentKind,
  environmentStatusColor,
  hasEnvironmentContext,
  isProductionEnvironment
} from './environment-color'

describe('environment-color', () => {
  it('detects production names', () => {
    expect(environmentKind('Produção')).toBe('production')
    expect(environmentKind('PROD')).toBe('production')
    expect(isProductionEnvironment('Production')).toBe(true)
    expect(hasEnvironmentContext('Produção')).toBe(true)
  })

  it('detects staging and development names', () => {
    expect(environmentKind('Homologação')).toBe('staging')
    expect(environmentKind('Dev local')).toBe('development')
    expect(hasEnvironmentContext('Homolog')).toBe(true)
    expect(hasEnvironmentContext('Dev')).toBe(true)
  })

  it('uses alert red for production by default', () => {
    expect(defaultEnvironmentColor('Produção')).toBe('#ef4444')
    expect(environmentStatusColor('Produção')).toBe('#ef4444')
  })

  it('prefers a custom color over the heuristic', () => {
    expect(environmentStatusColor('Produção', '#a855f7')).toBe('#a855f7')
    expect(environmentStatusColor('Homolog', '#14b8a6')).toBe('#14b8a6')
  })

  it('maps known kinds to short badge labels and messages', () => {
    expect(environmentBadgeLabel('Produção')).toBe('PROD')
    expect(environmentBadgeLabel('Homolog')).toBe('HML')
    expect(environmentBadgeLabel('Sandbox')).toBe('DEV')
    expect(environmentBadgeLabel('UAT')).toBe('UAT')
    expect(environmentContextMessage('Produção')).toMatch(/live/i)
    expect(environmentContextMessage('Homologação')).toMatch(/homologação/i)
    expect(environmentContextMessage('Dev')).toMatch(/desenvolvimento/i)
  })
})
