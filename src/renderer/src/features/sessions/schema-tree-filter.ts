import type { DatabaseSchemaNode } from '@shared/protocols'

export type SchemaTreeMatch = {
  schema: string
  table: string
}

/** Case-insensitive substring filter on schema and table names. */
export function filterSchemaTree(
  schemas: DatabaseSchemaNode[],
  query: string
): DatabaseSchemaNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return schemas

  const result: DatabaseSchemaNode[] = []
  for (const schema of schemas) {
    const schemaMatch = schema.name.toLowerCase().includes(q)
    const matchingTables = schema.tables.filter((table) => table.name.toLowerCase().includes(q))
    if (schemaMatch) {
      result.push(schema)
    } else if (matchingTables.length > 0) {
      result.push({ ...schema, tables: matchingTables })
    }
  }
  return result
}

/** First table in filtered tree order (schema order, then table order). */
export function firstFilteredTable(schemas: DatabaseSchemaNode[]): SchemaTreeMatch | null {
  for (const schema of schemas) {
    const table = schema.tables[0]
    if (table) return { schema: schema.name, table: table.name }
  }
  return null
}
