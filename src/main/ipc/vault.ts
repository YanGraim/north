import { IpcChannels } from '@shared/ipc'
import { IdSchema, RevealSecretInputSchema, SetSecretInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'
import type { InventoryStore } from '../workspaces/inventory-store'
import type { SecretStore } from '../workspaces/secret-store'

/**
 * Reveal is only allowed when the credentialRef is owned by an Access or Connection.
 * Prevents arbitrary vault reads from the renderer.
 */
function assertCredentialOwnership(repos: Repositories, credentialRef: string): void {
  const ownedByAccess = repos.accesses.findByCredentialRef(credentialRef)
  if (ownedByAccess) return
  const ownedByConnection = repos.connections.findByCredentialRef(credentialRef)
  if (ownedByConnection) return
  const ownedByApiVariable = repos.apiVariables.findByCredentialRef(credentialRef)
  if (ownedByApiVariable) return
  throw new Error('Credential ref is not owned by an access or connection')
}

/**
 * The channels follow the active workspace: the local vault for the personal
 * one, the North Server for an organization (which checks ownership and
 * audits every reveal itself).
 */
export function registerVaultHandlers(
  vault: CredentialVault,
  repos: Repositories,
  secrets: () => SecretStore,
  inventory: () => InventoryStore
): void {
  ipcMain.handle(IpcChannels.VAULT_SET_SECRET, (_event, input: unknown) => {
    const parsed = SetSecretInputSchema.parse(input)
    return secrets().set(parsed.secret, parsed.credentialRef)
  })

  ipcMain.handle(IpcChannels.VAULT_DELETE_SECRET, async (_event, credentialRef: unknown) => {
    await secrets().delete(IdSchema.parse(credentialRef))
  })

  ipcMain.handle(IpcChannels.VAULT_HAS_SECRET, (_event, credentialRef: unknown) => {
    return secrets().has(IdSchema.parse(credentialRef))
  })

  ipcMain.handle(IpcChannels.VAULT_IS_AVAILABLE, () => {
    return secrets().isAvailable()
  })

  ipcMain.handle(IpcChannels.VAULT_REVEAL_SECRET, (_event, input: unknown) => {
    const { credentialRef } = RevealSecretInputSchema.parse(input)
    const store = secrets()
    if (store.kind === 'remote') return store.resolve(credentialRef, 'reveal')
    assertCredentialOwnership(repos, credentialRef)
    if (!vault.hasSecret(credentialRef)) {
      throw new Error('Secret not found')
    }
    return vault.resolveSecret(credentialRef)
  })

  ipcMain.handle(
    IpcChannels.VAULT_REVEAL_CONNECTION_SECRET,
    async (_event, connectionId: unknown) => {
      const id = IdSchema.parse(connectionId)
      const store = secrets()
      if (store.kind === 'remote') {
        // Organizations keep one password per connection (no sudo bag yet).
        const ref = (await inventory().connections.get(id))?.credentialRef
        return ref ? store.resolve(ref, 'paste') : null
      }
      // sudo first (what "Colar senha" is usually for), fall back to the login password.
      const entry =
        repos.connectionSecrets.getByKind(id, 'sudo') ??
        repos.connectionSecrets.getByKind(id, 'password')
      if (!entry || !vault.hasSecret(entry.credentialRef)) return null
      return vault.resolveSecret(entry.credentialRef)
    }
  )
}
