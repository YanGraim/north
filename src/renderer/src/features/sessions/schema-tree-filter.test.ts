import type { DatabaseSchemaNode } from '@shared/protocols'
import { describe, expect, it } from 'vitest'
import { filterSchemaTree, firstFilteredTable } from './schema-tree-filter'

const tree: DatabaseSchemaNode[] = [
  {
    name: 'public',
    tables: [
      { name: 'orders', type: 'table', columns: [] },
      { name: 'users', type: 'table', columns: [] },
      { name: 'order_items', type: 'table', columns: [] }
    ]
  },
  {
    name: 'inventory',
    tables: [
      { name: 'skus', type: 'table', columns: [] },
      { name: 'warehouses', type: 'table', columns: [] }
    ]
  }
]

describe('filterSchemaTree', () => {
  it('returns the full tree when the query is empty', () => {
    expect(filterSchemaTree(tree, '')).toBe(tree)
    expect(filterSchemaTree(tree, '   ')).toBe(tree)
  })

  it('filters tables by case-insensitive substring', () => {
    const filtered = filterSchemaTree(tree, 'ORDER')
    expect(filtered).toEqual([
      {
        name: 'public',
        tables: [
          { name: 'orders', type: 'table', columns: [] },
          { name: 'order_items', type: 'table', columns: [] }
        ]
      }
    ])
  })

  it('includes a schema with all tables when the schema name matches', () => {
    const filtered = filterSchemaTree(tree, 'invent')
    expect(filtered).toEqual([tree[1]])
  })

  it('keeps only schemas that have a match', () => {
    expect(filterSchemaTree(tree, 'sku')).toEqual([
      {
        name: 'inventory',
        tables: [{ name: 'skus', type: 'table', columns: [] }]
      }
    ])
    expect(filterSchemaTree(tree, 'zzz')).toEqual([])
  })
})

describe('firstFilteredTable', () => {
  it('returns the first table in tree order', () => {
    expect(firstFilteredTable(filterSchemaTree(tree, 'order'))).toEqual({
      schema: 'public',
      table: 'orders'
    })
  })

  it('returns null when there are no tables', () => {
    expect(firstFilteredTable([])).toBeNull()
    expect(firstFilteredTable([{ name: 'empty', tables: [] }])).toBeNull()
  })
})
