import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const base = {
  DATABASE_URL: 'postgres://north:north@localhost:5432/north',
  NORTH_JWT_SECRET: 'x'.repeat(32)
}

describe('loadConfig', () => {
  it('reads the minimal environment with defaults', () => {
    const config = loadConfig(base)
    expect(config.port).toBe(8080)
    expect(config.host).toBe('0.0.0.0')
    expect(config.accessTokenTtlSec).toBe(600)
    expect(config.authModes).toEqual(['entra'])
    expect(config.organizationName).toBe('North')
  })

  it('requires a database url', () => {
    expect(() => loadConfig({ NORTH_JWT_SECRET: 'x'.repeat(32) })).toThrow(/DATABASE_URL/)
  })

  it('requires a jwt secret of at least 32 chars', () => {
    expect(() => loadConfig({ ...base, NORTH_JWT_SECRET: 'short' })).toThrow(/NORTH_JWT_SECRET/)
  })

  it('caps the access token between 5 and 10 minutes (ADR 0018 §6)', () => {
    expect(() => loadConfig({ ...base, NORTH_ACCESS_TOKEN_TTL_SEC: '60' })).toThrow()
    expect(() => loadConfig({ ...base, NORTH_ACCESS_TOKEN_TTL_SEC: '3600' })).toThrow()
    expect(loadConfig({ ...base, NORTH_ACCESS_TOKEN_TTL_SEC: '300' }).accessTokenTtlSec).toBe(300)
  })

  it('parses a comma separated list of auth modes', () => {
    expect(loadConfig({ ...base, NORTH_AUTH_MODES: 'dev, entra' }).authModes).toEqual([
      'dev',
      'entra'
    ])
  })

  it('rejects unknown auth modes', () => {
    expect(() => loadConfig({ ...base, NORTH_AUTH_MODES: 'ldap' })).toThrow()
  })

  it('refuses dev login in production unless explicitly allowed', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', NORTH_AUTH_MODES: 'dev' })).toThrow(
      /dev/
    )
    expect(
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        NORTH_AUTH_MODES: 'dev',
        NORTH_ALLOW_DEV_AUTH: '1'
      }).authModes
    ).toEqual(['dev'])
  })

  it('takes the organization display name', () => {
    expect(loadConfig({ ...base, NORTH_ORGANIZATION_NAME: 'Acme' }).organizationName).toBe('Acme')
  })
})
