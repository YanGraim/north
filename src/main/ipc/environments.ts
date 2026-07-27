import { IpcChannels } from '@shared/ipc'
import { CreateEnvironmentInputSchema, IdSchema, UpdateEnvironmentInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import { deleteSecretsForScope } from './vault-cleanup'

function requireEntity<T>(entity: T | null, label: string): T {
  if (!entity) {
    throw new Error(`${label} not found`)
  }
  return entity
}

export function registerEnvironmentHandlers(repos: Repositories, vault: CredentialVault): void {
  ipcMain.handle(IpcChannels.ENVIRONMENTS_LIST, (_event, clientId?: unknown) => {
    const parsed =
      clientId === undefined || clientId === null ? undefined : IdSchema.parse(clientId)
    return repos.environments.list(parsed)
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_GET, (_event, id: unknown) => {
    return repos.environments.get(IdSchema.parse(id))
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_CREATE, (_event, input: unknown) => {
    return repos.environments.create(CreateEnvironmentInputSchema.parse(input))
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_UPDATE, (_event, id: unknown, input: unknown) => {
    const updated = repos.environments.update(
      IdSchema.parse(id),
      UpdateEnvironmentInputSchema.parse(input)
    )
    return requireEntity(updated, 'Environment')
  })

  ipcMain.handle(IpcChannels.ENVIRONMENTS_DELETE, (_event, id: unknown) => {
    const environmentId = IdSchema.parse(id)
    if (!repos.environments.get(environmentId)) {
      throw new Error('Environment not found')
    }
    deleteSecretsForScope(repos, vault, { environmentId })
    repos.environments.delete(environmentId)
  })
}
