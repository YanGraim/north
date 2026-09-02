import type { ParsedPostmanCollection } from '@shared/lib/postman-collection'
import { serializePostmanCollection } from '@shared/lib/postman-collection'
import type { ApiCollection } from '@shared/types'
import type { Repositories } from '../../repositories'

export function duplicateCollection(repos: Repositories, id: string): ApiCollection {
  const existing = repos.apiCollections.getCollection(id)
  if (!existing) {
    throw new Error('ApiCollection not found')
  }
  const copy = repos.apiCollections.createCollection({
    clientId: existing.clientId,
    name: `${existing.name} (cópia)`,
    description: existing.description
  })
  const folders = repos.apiCollections.listFolders(id)
  const idMap = new Map<string, string>()
  const remaining = [...folders]
  while (remaining.length > 0) {
    const index = remaining.findIndex(
      (folder) => !folder.parentFolderId || idMap.has(folder.parentFolderId)
    )
    if (index < 0) break
    const folder = remaining.splice(index, 1)[0]
    if (!folder) break
    const created = repos.apiCollections.createFolder({
      collectionId: copy.id,
      parentFolderId: folder.parentFolderId ? (idMap.get(folder.parentFolderId) ?? null) : null,
      name: folder.name
    })
    idMap.set(folder.id, created.id)
  }
  for (const request of repos.apiRequests.listByCollection(id)) {
    repos.apiRequests.create({
      collectionId: copy.id,
      folderId: request.folderId ? (idMap.get(request.folderId) ?? null) : null,
      name: request.name,
      method: request.method,
      url: request.url,
      definition: request.definition
    })
  }
  return copy
}

export function importParsedCollection(
  repos: Repositories,
  parsed: ParsedPostmanCollection,
  clientId: string | null
): ApiCollection {
  const collection = repos.apiCollections.createCollection({
    clientId,
    name: parsed.name,
    description: parsed.description
  })
  const idMap = new Map<string, string>()
  for (const folder of parsed.folders) {
    const created = repos.apiCollections.createFolder({
      collectionId: collection.id,
      parentFolderId: folder.parentTempId ? (idMap.get(folder.parentTempId) ?? null) : null,
      name: folder.name
    })
    idMap.set(folder.tempId, created.id)
  }
  for (const request of parsed.requests) {
    repos.apiRequests.create({
      collectionId: collection.id,
      folderId: request.folderTempId ? (idMap.get(request.folderTempId) ?? null) : null,
      name: request.name,
      method: request.method,
      url: request.url,
      definition: request.definition
    })
  }
  return collection
}

export function exportCollectionJson(
  repos: Repositories,
  id: string
): ReturnType<typeof serializePostmanCollection> {
  const collection = repos.apiCollections.getCollection(id)
  if (!collection) {
    throw new Error('ApiCollection not found')
  }
  return serializePostmanCollection({
    name: collection.name,
    description: collection.description,
    folders: repos.apiCollections.listFolders(id),
    requests: repos.apiRequests.listByCollection(id)
  })
}
