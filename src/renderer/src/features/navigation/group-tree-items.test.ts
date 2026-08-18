import type { Access, Connection } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { findGroupIdForSelectedItem, listGroupLeaves } from './group-tree-items'

const GROUP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function connection(
  partial: Partial<Connection> & Pick<Connection, 'id' | 'name' | 'groupId'>
): Connection {
  return {
    protocol: 'ssh',
    host: '10.0.0.1',
    port: 22,
    username: null,
    authMethod: 'password',
    credentialRef: null,
    privateKeyPath: null,
    jumpHostId: null,
    defaultCommand: null,
    description: null,
    notes: null,
    os: null,
    owner: null,
    links: [],
    icon: null,
    color: null,
    vpnRequired: false,
    checklist: [],
    relatedFiles: [],
    isFavorite: false,
    accessCount: 0,
    totalConnectedMs: 0,
    lastConnectedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

function access(partial: Partial<Access> & Pick<Access, 'id' | 'name' | 'groupId'>): Access {
  return {
    type: 'database',
    description: null,
    notes: null,
    username: null,
    credentialRef: null,
    url: null,
    links: [],
    icon: null,
    color: null,
    isFavorite: false,
    engine: 'postgres',
    host: 'db',
    port: 5432,
    database: null,
    ssl: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial
  }
}

describe('listGroupLeaves', () => {
  it('lists connections and accesses for a group sorted by name', () => {
    const leaves = listGroupLeaves(
      [
        connection({
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: 'Zeta SSH',
          groupId: GROUP_A
        }),
        connection({
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Alpha SSH',
          groupId: GROUP_A
        }),
        connection({
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          name: 'Other group',
          groupId: GROUP_B
        })
      ],
      [
        access({
          id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
          name: 'Beta DB',
          groupId: GROUP_A,
          engine: 'redis'
        })
      ],
      GROUP_A
    )

    expect(leaves.map((leaf) => leaf.name)).toEqual(['Alpha SSH', 'Beta DB', 'Zeta SSH'])
    expect(leaves).toHaveLength(3)
  })
})

describe('findGroupIdForSelectedItem', () => {
  it('resolves group from connection or access deep link', () => {
    const connections = [
      connection({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'SSH', groupId: GROUP_A })
    ]
    const accesses = [
      access({ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'DB', groupId: GROUP_B })
    ]

    expect(
      findGroupIdForSelectedItem(
        connections,
        accesses,
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        null
      )
    ).toBe(GROUP_A)
    expect(
      findGroupIdForSelectedItem(
        connections,
        accesses,
        null,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      )
    ).toBe(GROUP_B)
    expect(findGroupIdForSelectedItem(connections, accesses, null, null)).toBeNull()
  })
})
