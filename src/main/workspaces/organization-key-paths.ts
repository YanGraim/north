import type { Connection } from '@shared/types'
import type { OrganizationKeyPathsRepository } from '../repositories/organization-key-paths-repository'
import type { InventoryStore } from './inventory-store'

/**
 * The organization inventory with this person's own SSH key paths: the server
 * never stores `privateKeyPath`, so it is kept on this computer per connection
 * and filled back in on every read. Sessions read connections through here too.
 */
export function withLocalKeyPaths(
  store: InventoryStore,
  keyPaths: OrganizationKeyPathsRepository,
  workspaceId: string
): InventoryStore {
  const read = <T extends Connection | null>(item: T): T =>
    item ? { ...item, privateKeyPath: keyPaths.get(workspaceId, item.id) } : item
  const { connections } = store
  return {
    ...store,
    connections: {
      list: async (filter) => (await connections.list(filter)).map(read),
      get: async (id) => read(await connections.get(id)),
      create: async (input) => {
        const created = await connections.create(input)
        keyPaths.set(workspaceId, created.id, input.privateKeyPath ?? null)
        return read(created)
      },
      update: async (id, input) => {
        if (input.privateKeyPath !== undefined) keyPaths.set(workspaceId, id, input.privateKeyPath)
        return read(await connections.update(id, input))
      },
      delete: async (id) => {
        const deleted = await connections.delete(id)
        keyPaths.set(workspaceId, id, null)
        return deleted
      },
      toggleFavorite: async (id) => read(await connections.toggleFavorite(id)),
      duplicate: async (id) => {
        const copy = await connections.duplicate(id)
        if (copy) keyPaths.set(workspaceId, copy.id, keyPaths.get(workspaceId, id))
        return read(copy)
      }
    }
  }
}
