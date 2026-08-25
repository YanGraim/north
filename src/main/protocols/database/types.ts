import type {
  DatabaseIntrospection,
  DatabaseQueryResult,
  DatabaseTxState,
  SqlStudioEngine
} from '@shared/protocols'

export type ResolvedDatabaseConfig = {
  engine: SqlStudioEngine
  host: string | null
  port: number | null
  database: string | null
  username: string | null
  password: string
  ssl: boolean
  filePath: string | null
}

export type DatabaseAdapter = {
  readonly engine: SqlStudioEngine
  connect(config: ResolvedDatabaseConfig): Promise<void>
  ping(): Promise<void>
  introspect(): Promise<DatabaseIntrospection>
  query(sql: string, options: { maxRows: number; timeoutMs: number }): Promise<DatabaseQueryResult>
  cancel(): Promise<void>
  getTxState(): DatabaseTxState
  setAutoCommit(on: boolean): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  dispose(): Promise<void>
}

export type IntrospectTableRow = {
  schema: string
  name: string
  type: 'table' | 'view'
}

export type IntrospectColumnRow = {
  schema: string
  table: string
  name: string
  dataType: string
  nullable: boolean
  primaryKey: boolean
  characterMaximumLength: number | null
}

export function groupIntrospection(
  tables: IntrospectTableRow[],
  columns: IntrospectColumnRow[]
): DatabaseIntrospection {
  const schemaMap = new Map<
    string,
    Map<string, { type: 'table' | 'view'; columns: IntrospectColumnRow[] }>
  >()

  for (const table of tables) {
    let relations = schemaMap.get(table.schema)
    if (!relations) {
      relations = new Map()
      schemaMap.set(table.schema, relations)
    }
    if (!relations.has(table.name)) {
      relations.set(table.name, { type: table.type, columns: [] })
    } else {
      const existing = relations.get(table.name)
      if (existing) existing.type = table.type
    }
  }

  for (const column of columns) {
    let relations = schemaMap.get(column.schema)
    if (!relations) {
      relations = new Map()
      schemaMap.set(column.schema, relations)
    }
    let relation = relations.get(column.table)
    if (!relation) {
      relation = { type: 'table', columns: [] }
      relations.set(column.table, relation)
    }
    relation.columns.push(column)
  }

  const schemas = [...schemaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, relations]) => ({
      name,
      tables: [...relations.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tableName, relation]) => ({
          name: tableName,
          type: relation.type,
          columns: relation.columns.map((column) => ({
            name: column.name,
            dataType: column.dataType,
            nullable: column.nullable,
            primaryKey: column.primaryKey,
            characterMaximumLength: column.characterMaximumLength
          }))
        }))
    }))

  return { schemas }
}
