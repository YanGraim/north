import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

const base = {
  DATABASE_URL: 'postgres://north:north@localhost:5432/north',
  NORTH_JWT_SECRET: 'x'.repeat(32),
  NORTH_OIDC_TENANT_ID: '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0',
  NORTH_OIDC_CLIENT_ID: 'c1d2e3f4-0000-1111-2222-333344445555'
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
        NORTH_ALLOW_DEV_AUTH: '1',
        NORTH_MASTER_KEY: Buffer.alloc(32).toString('base64')
      }).authModes
    ).toEqual(['dev'])
  })

  it('takes the organization display name', () => {
    expect(loadConfig({ ...base, NORTH_ORGANIZATION_NAME: 'Acme' }).organizationName).toBe('Acme')
  })

  it('has no master key unless one is configured', () => {
    expect(loadConfig(base).masterKey).toBeNull()
    const key = Buffer.alloc(32, 7).toString('base64')
    expect(loadConfig({ ...base, NORTH_MASTER_KEY: key }).masterKey?.length).toBe(32)
  })

  it('requires a master key in production', () => {
    const prod = { ...base, NODE_ENV: 'production', NORTH_AUTH_MODES: 'entra' }
    expect(() => loadConfig(prod)).toThrow(/NORTH_MASTER_KEY/)
    expect(
      loadConfig({ ...prod, NORTH_MASTER_KEY: Buffer.alloc(32).toString('base64') }).masterKey
    ).not.toBeNull()
  })

  describe('Entra sign-in', () => {
    it('derives the Microsoft issuer from the tenant id', () => {
      expect(loadConfig(base).oidc).toEqual({
        issuer: 'https://login.microsoftonline.com/0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0/v2.0',
        clientId: 'c1d2e3f4-0000-1111-2222-333344445555',
        tenantId: '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0',
        adminGroups: [],
        allowNewUsers: true
      })
    })

    it('needs the client id and the tenant id', () => {
      expect(() => loadConfig({ ...base, NORTH_OIDC_CLIENT_ID: '' })).toThrow(
        /NORTH_OIDC_CLIENT_ID/
      )
      expect(() => loadConfig({ ...base, NORTH_OIDC_TENANT_ID: undefined })).toThrow(
        /NORTH_OIDC_TENANT_ID/
      )
      expect(() => loadConfig({ ...base, NORTH_OIDC_TENANT_ID: 'acme.onmicrosoft.com' })).toThrow(
        /Directory \(tenant\) ID/
      )
    })

    it('is off when only the dev mode is on', () => {
      expect(loadConfig({ ...base, NORTH_AUTH_MODES: 'dev' }).oidc).toBeNull()
    })

    it('reads admin groups, the invite-only switch and a custom issuer', () => {
      const oidc = loadConfig({
        ...base,
        NORTH_OIDC_TENANT_ID: undefined,
        NORTH_OIDC_ISSUER: 'http://127.0.0.1:9999/t/v2.0/',
        NORTH_OIDC_ADMIN_GROUPS: ' g1 , g2 ',
        NORTH_OIDC_ALLOW_NEW_USERS: '0'
      }).oidc
      expect(oidc).toMatchObject({
        issuer: 'http://127.0.0.1:9999/t/v2.0',
        tenantId: null,
        adminGroups: ['g1', 'g2'],
        allowNewUsers: false
      })
    })
  })
})
