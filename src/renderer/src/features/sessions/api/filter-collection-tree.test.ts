import type { ApiCollection, ApiFolder, ApiRequest } from '@shared/types'
import { emptyApiRequestDefinition } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { filterCollectionTree } from './filter-collection-tree'

const now = '2026-01-01T00:00:00.000Z'

function collection(id: string, name: string): ApiCollection {
  return {
    id,
    clientId: null,
    name,
    description: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  }
}

function folder(
  id: string,
  collectionId: string,
  name: string,
  parentFolderId: string | null
): ApiFolder {
  return {
    id,
    collectionId,
    parentFolderId,
    name,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  }
}

function request(
  id: string,
  collectionId: string,
  folderId: string | null,
  name: string,
  method: ApiRequest['method'],
  url: string
): ApiRequest {
  return {
    id,
    collectionId,
    folderId,
    name,
    method,
    url,
    definition: emptyApiRequestDefinition(),
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  }
}

const shop = collection('col-shop', 'Shop')
const users = collection('col-users', 'Users')
const orders = folder('fld-orders', shop.id, 'Orders', null)
const admin = folder('fld-admin', shop.id, 'Admin', orders.id)
const listOrders = request('req-list', shop.id, admin.id, 'List orders', 'GET', '/orders')
const createOrder = request('req-create', shop.id, orders.id, 'Create order', 'POST', '/orders')
const health = request('req-health', shop.id, null, 'Health', 'GET', '/health')
const getUser = request('req-user', users.id, null, 'Get user', 'GET', '/users/1')

const tree = {
  collections: [shop, users],
  foldersByCollection: {
    [shop.id]: [orders, admin],
    [users.id]: []
  },
  requestsByCollection: {
    [shop.id]: [listOrders, createOrder, health],
    [users.id]: [getUser]
  }
}

describe('filterCollectionTree', () => {
  it('returns the full tree when the query is empty', () => {
    const filtered = filterCollectionTree(tree, '  ')
    expect(filtered.collections).toEqual(tree.collections)
    expect(filtered.expandedIds.size).toBe(0)
  })

  it('matches request name, method, and URL', () => {
    const byName = filterCollectionTree(tree, 'health')
    expect(byName.requestsByCollection[shop.id]?.map((item) => item.id)).toEqual([health.id])
    expect(byName.collections.map((item) => item.id)).toEqual([shop.id])
    expect(byName.expandedIds.has(shop.id)).toBe(true)

    const byMethod = filterCollectionTree(tree, 'post')
    expect(byMethod.requestsByCollection[shop.id]?.map((item) => item.id)).toEqual([createOrder.id])
    expect(byMethod.expandedIds.has(orders.id)).toBe(true)

    const byUrl = filterCollectionTree(tree, '/users')
    expect(byUrl.collections.map((item) => item.id)).toEqual([users.id])
    expect(byUrl.requestsByCollection[users.id]?.map((item) => item.id)).toEqual([getUser.id])
  })

  it('includes the subtree when a folder or collection name matches', () => {
    const byFolder = filterCollectionTree(tree, 'admin')
    expect(byFolder.foldersByCollection[shop.id]?.map((item) => item.id)).toEqual([
      orders.id,
      admin.id
    ])
    expect(byFolder.requestsByCollection[shop.id]?.map((item) => item.id)).toEqual([listOrders.id])
    expect(byFolder.expandedIds.has(shop.id)).toBe(true)
    expect(byFolder.expandedIds.has(orders.id)).toBe(true)
    expect(byFolder.expandedIds.has(admin.id)).toBe(true)

    const byCollection = filterCollectionTree(tree, 'shop')
    expect(byCollection.foldersByCollection[shop.id]).toEqual([orders, admin])
    expect(byCollection.requestsByCollection[shop.id]).toEqual([listOrders, createOrder, health])
    expect(byCollection.collections.map((item) => item.id)).toEqual([shop.id])
  })

  it('returns an empty list when nothing matches', () => {
    const filtered = filterCollectionTree(tree, 'zzz')
    expect(filtered.collections).toEqual([])
  })
})
