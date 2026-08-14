import type { DatabaseTestResult, SqlStudioEngine } from '@shared/protocols'
import { MssqlAdapter } from './mssql-adapter'
import { MysqlAdapter } from './mysql-adapter'
import { PostgresAdapter } from './postgres-adapter'
import { SqliteAdapter } from './sqlite-adapter'
import type { DatabaseAdapter, ResolvedDatabaseConfig } from './types'

export function createAdapter(engine: SqlStudioEngine): DatabaseAdapter {
  switch (engine) {
    case 'postgres':
      return new PostgresAdapter()
    case 'mysql':
      return new MysqlAdapter('mysql')
    case 'mariadb':
      return new MysqlAdapter('mariadb')
    case 'mssql':
      return new MssqlAdapter()
    case 'sqlite':
      return new SqliteAdapter()
  }
}

export async function connectAdapter(config: ResolvedDatabaseConfig): Promise<DatabaseAdapter> {
  const adapter = createAdapter(config.engine)
  await adapter.connect(config)
  return adapter
}

export async function testConnection(config: ResolvedDatabaseConfig): Promise<DatabaseTestResult> {
  const started = Date.now()
  const adapter = createAdapter(config.engine)
  try {
    await adapter.connect(config)
    await adapter.ping()
    return { ok: true, latencyMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao conectar'
    }
  } finally {
    await adapter.dispose().catch(() => undefined)
  }
}
