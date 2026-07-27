import { CSV_TEMPLATE_CONTENT, parseInventoryCsvRow } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '../database/test-utils'
import { CredentialVault, FakeEncryptor } from '../vault'
import { importInventoryCsv } from './inventory-csv-import'

describe('parseInventoryCsvRow', () => {
  it('accepts a valid servidor row', () => {
    const result = parseInventoryCsvRow({
      tipo: 'servidor',
      cliente: 'Acme',
      ambiente: 'Prod',
      grupo: 'App',
      nome: 'web-01',
      protocolo: 'ssh',
      engine: '',
      host: '10.0.0.1',
      porta: '22',
      database: '',
      url: '',
      usuario: 'ubuntu',
      senha: '',
      notas: '',
      tags: 'ssh,prod'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tipo).toBe('servidor')
      if (result.data.tipo === 'servidor') {
        expect(result.data.protocolo).toBe('ssh')
        expect(result.data.porta).toBe(22)
      }
    }
  })

  it('rejects servidor without host', () => {
    const result = parseInventoryCsvRow({
      tipo: 'servidor',
      cliente: 'Acme',
      ambiente: 'Prod',
      grupo: 'App',
      nome: 'web-01',
      protocolo: 'ssh',
      engine: '',
      host: '',
      porta: '22',
      database: '',
      url: '',
      usuario: '',
      senha: '',
      notas: '',
      tags: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/host/i)
    }
  })

  it('rejects invalid porta', () => {
    const result = parseInventoryCsvRow({
      tipo: 'banco',
      cliente: 'Acme',
      ambiente: 'Prod',
      grupo: 'App',
      nome: 'db',
      protocolo: '',
      engine: 'postgres',
      host: '10.0.0.2',
      porta: 'abc',
      database: 'app',
      url: '',
      usuario: '',
      senha: '',
      notas: '',
      tags: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/porta/i)
    }
  })
})

describe('importInventoryCsv', () => {
  it('creates hierarchy, connection, database and login accesses from the template', () => {
    const { repos } = createTestRepositories()
    const report = importInventoryCsv(repos, CSV_TEMPLATE_CONTENT, { allowSecrets: false })

    expect(report.errors).toEqual([])
    expect(report.created.clients).toBe(1)
    expect(report.created.environments).toBe(1)
    expect(report.created.groups).toBe(1)
    expect(report.created.connections).toBe(1)
    expect(report.created.accesses).toBe(2)
    expect(repos.connections.list()).toHaveLength(1)
    expect(repos.accesses.list({ type: 'database' })).toHaveLength(1)
    expect(repos.accesses.list({ type: 'login' })).toHaveLength(1)
  })

  it('merges by name case-insensitive and skips duplicates', () => {
    const { repos } = createTestRepositories()
    const csv = [
      'tipo,cliente,ambiente,grupo,nome,protocolo,engine,host,porta,database,url,usuario,senha,notas,tags',
      'servidor,Acme,Prod,App,web-01,ssh,,10.0.0.1,22,,,ubuntu,,,',
      'servidor,acme,prod,app,WEB-01,ssh,,10.0.0.9,22,,,ubuntu,,,',
      ''
    ].join('\n')

    const first = importInventoryCsv(repos, csv, { allowSecrets: false })
    expect(first.created.connections).toBe(1)
    expect(first.skipped.connections).toBe(1)

    const second = importInventoryCsv(repos, csv, { allowSecrets: false })
    expect(second.created.connections).toBe(0)
    expect(second.skipped.connections).toBe(2)
    expect(repos.clients.list()).toHaveLength(1)
    expect(repos.connections.list()).toHaveLength(1)
  })

  it('stores passwords in the vault when allowSecrets is true', () => {
    const { repos } = createTestRepositories()
    const vault = new CredentialVault(repos.credentials, new FakeEncryptor())
    const csv = [
      'tipo,cliente,ambiente,grupo,nome,protocolo,engine,host,porta,database,url,usuario,senha,notas,tags',
      'servidor,Acme,Prod,App,web-01,ssh,,10.0.0.1,22,,,ubuntu,s3cret,,,',
      ''
    ].join('\n')

    const report = importInventoryCsv(repos, csv, { allowSecrets: true }, vault)
    expect(report.errors).toEqual([])
    expect(report.created.connections).toBe(1)

    const conn = repos.connections.list()[0]
    expect(conn.credentialRef).toBeTruthy()
    expect(vault.resolveSecret(conn.credentialRef!)).toBe('s3cret')
  })

  it('reports line-numbered errors and skips password without allowSecrets', () => {
    const { repos } = createTestRepositories()
    const csv = [
      'tipo,cliente,ambiente,grupo,nome,protocolo,engine,host,porta,database,url,usuario,senha,notas,tags',
      'servidor,Acme,Prod,App,bad,ssh,,10.0.0.1,not-a-port,,,ubuntu,,,',
      'servidor,Acme,Prod,App,ok,ssh,,10.0.0.1,22,,,ubuntu,secret,,,',
      ''
    ].join('\n')

    const report = importInventoryCsv(repos, csv, { allowSecrets: false })
    expect(report.errors.some((e) => e.startsWith('Linha 2:') && /porta/i.test(e))).toBe(true)
    expect(report.errors.some((e) => e.startsWith('Linha 3:') && /senha/i.test(e))).toBe(true)
    expect(report.created.connections).toBe(1)
    expect(repos.connections.list()[0].credentialRef).toBeNull()
  })
})
