import { describe, expect, it } from 'vitest'
import { groupIntrospection } from './types'

describe('groupIntrospection', () => {
  it('nests columns under schema.table', () => {
    const tree = groupIntrospection(
      [
        { schema: 'public', name: 'users', type: 'table' },
        { schema: 'public', name: 'v_ok', type: 'view' }
      ],
      [
        {
          schema: 'public',
          table: 'users',
          name: 'id',
          dataType: 'int',
          nullable: false,
          primaryKey: true,
          characterMaximumLength: null
        },
        {
          schema: 'public',
          table: 'v_ok',
          name: 'n',
          dataType: 'text',
          nullable: true,
          primaryKey: false,
          characterMaximumLength: null
        }
      ]
    )
    expect(tree.schemas).toHaveLength(1)
    expect(tree.schemas[0]?.tables.map((t) => t.name)).toEqual(['users', 'v_ok'])
    expect(tree.schemas[0]?.tables[1]?.type).toBe('view')
  })
})
