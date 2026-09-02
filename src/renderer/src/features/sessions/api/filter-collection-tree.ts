import type { ApiCollection, ApiFolder, ApiRequest } from '@shared/types'

export type CollectionTreeInput = {
  collections: ApiCollection[]
  foldersByCollection: Record<string, ApiFolder[]>
  requestsByCollection: Record<string, ApiRequest[]>
}

export type FilteredCollectionTree = CollectionTreeInput & {
  expandedIds: Set<string>
}

function hay(value: string): string {
  return value.toLowerCase()
}

function requestMatches(request: ApiRequest, needle: string): boolean {
  return (
    hay(request.name).includes(needle) ||
    hay(request.method).includes(needle) ||
    hay(request.url).includes(needle)
  )
}

function descendantFolderIds(folderId: string, folders: ApiFolder[]): Set<string> {
  const children = new Map<string | null, ApiFolder[]>()
  for (const folder of folders) {
    const parent = folder.parentFolderId
    const list = children.get(parent) ?? []
    list.push(folder)
    children.set(parent, list)
  }
  const ids = new Set<string>([folderId])
  const stack = [folderId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    for (const child of children.get(current) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return ids
}

function ancestorFolderIds(folderId: string | null, folders: ApiFolder[]): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const ids: string[] = []
  let current = folderId
  while (current) {
    ids.push(current)
    current = byId.get(current)?.parentFolderId ?? null
  }
  return ids
}

export function filterCollectionTree(
  data: CollectionTreeInput,
  query: string
): FilteredCollectionTree {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return { ...data, expandedIds: new Set() }
  }

  const expandedIds = new Set<string>()
  const collections: ApiCollection[] = []
  const foldersByCollection: Record<string, ApiFolder[]> = {}
  const requestsByCollection: Record<string, ApiRequest[]> = {}

  for (const collection of data.collections) {
    const folders = data.foldersByCollection[collection.id] ?? []
    const requests = data.requestsByCollection[collection.id] ?? []

    if (hay(collection.name).includes(needle)) {
      collections.push(collection)
      foldersByCollection[collection.id] = folders
      requestsByCollection[collection.id] = requests
      expandedIds.add(collection.id)
      for (const folder of folders) expandedIds.add(folder.id)
      continue
    }

    const subtreeFolderIds = new Set<string>()
    const ancestorIds = new Set<string>()
    const keepRequestIds = new Set<string>()

    for (const folder of folders) {
      if (!hay(folder.name).includes(needle)) continue
      const subtree = descendantFolderIds(folder.id, folders)
      for (const id of subtree) subtreeFolderIds.add(id)
      for (const id of ancestorFolderIds(folder.parentFolderId, folders)) ancestorIds.add(id)
      expandedIds.add(collection.id)
      for (const id of subtree) expandedIds.add(id)
      for (const id of ancestorFolderIds(folder.parentFolderId, folders)) expandedIds.add(id)
    }

    for (const request of requests) {
      if (request.folderId && subtreeFolderIds.has(request.folderId)) {
        keepRequestIds.add(request.id)
        continue
      }
      if (!requestMatches(request, needle)) continue
      keepRequestIds.add(request.id)
      expandedIds.add(collection.id)
      for (const id of ancestorFolderIds(request.folderId, folders)) {
        ancestorIds.add(id)
        expandedIds.add(id)
      }
    }

    const keepFolderIds = new Set([...subtreeFolderIds, ...ancestorIds])
    const keptFolders = folders.filter((folder) => keepFolderIds.has(folder.id))
    const keptRequests = requests.filter((request) => keepRequestIds.has(request.id))
    if (keptFolders.length === 0 && keptRequests.length === 0) continue

    collections.push(collection)
    foldersByCollection[collection.id] = keptFolders
    requestsByCollection[collection.id] = keptRequests
  }

  return { collections, foldersByCollection, requestsByCollection, expandedIds }
}
