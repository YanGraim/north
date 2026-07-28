import type { SearchIndexItem } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { groupSearchHits, highlightMatches, searchIndex } from './search'

function item(
  partial: Partial<SearchIndexItem> & Pick<SearchIndexItem, 'id' | 'kind' | 'name'>
): SearchIndexItem {
  return {
    title: partial.name,
    subtitle: null,
    host: null,
    description: null,
    notes: null,
    owner: null,
    clientName: null,
    environmentName: null,
    groupName: null,
    tags: null,
    username: null,
    url: null,
    database: null,
    accessType: null,
    clientId: null,
    environmentId: null,
    groupId: null,
    connectionId: null,
    accessId: null,
    tagId: null,
    isFavorite: false,
    lastConnectedAt: null,
    protocol: null,
    icon: null,
    ...partial
  }
}

describe('searchIndex (fuse.js)', () => {
  const index: SearchIndexItem[] = [
    item({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'connection',
      name: 'api-gateway',
      host: '10.20.30.40',
      notes: 'checklist vpn jump',
      clientName: 'Acme'
    }),
    item({
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'connection',
      name: 'db-primary',
      host: '192.168.1.10',
      notes: 'postgres'
    }),
    item({
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'client',
      name: 'Acme'
    })
  ]

  it('finds connection by partial host typo', () => {
    const hits = searchIndex(index, '10.20.30')
    expect(hits[0]?.item.name).toBe('api-gateway')
  })

  it('finds connection by note content', () => {
    const hits = searchIndex(index, 'jump')
    expect(hits.some((hit) => hit.item.name === 'api-gateway')).toBe(true)
  })

  it('groups hits by kind', () => {
    const grouped = groupSearchHits(searchIndex(index, 'acme'))
    expect(grouped.client.length).toBeGreaterThan(0)
    expect(grouped.connection.length).toBeGreaterThan(0)
  })

  it('highlights matched ranges', () => {
    const parts = highlightMatches('api-gateway', [[0, 2]])
    expect(parts[0]).toEqual({ text: 'api', matched: true })
    expect(parts[1]?.matched).toBe(false)
  })
})
