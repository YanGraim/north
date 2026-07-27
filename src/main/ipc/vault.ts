import { IpcChannels } from '@shared/ipc'
import { IdSchema, RevealSecretInputSchema, SetSecretInputSchema } from '@shared/types'
import { ipcMain } from 'electron'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'

/**
 * Reveal is only allowed when the credentialRef is owned by an Access or Connection.
 * Prevents arbitrary vault reads from the renderer.
 */
function assertCredentialOwnership(repos: Repositories, credentialRef: string): void {
  const ownedByAccess = repos.accesses.findByCredentialRef(credentialRef)
  if (ownedByAccess) return
  const ownedByConnection = repos.connections.findByCredentialRef(credentialRef)
  if (ownedByConnection) return
  throw new Error('Credential ref is not owned by an access or connection')
}

export function registerVaultHandlers(vault: CredentialVault, repos: Repositories): void {
  ipcMain.handle(IpcChannels.VAULT_SET_SECRET, (_event, input: unknown) => {
    const parsed = SetSecretInputSchema.parse(input)
    return vault.setSecret(parsed.secret, parsed.credentialRef)
  })

  ipcMain.handle(IpcChannels.VAULT_DELETE_SECRET, (_event, credentialRef: unknown) => {
    vault.deleteSecret(IdSchema.parse(credentialRef))
  })

  ipcMain.handle(IpcChannels.VAULT_HAS_SECRET, (_event, credentialRef: unknown) => {
    return vault.hasSecret(IdSchema.parse(credentialRef))
  })

  ipcMain.handle(IpcChannels.VAULT_IS_AVAILABLE, () => {
    return vault.isEncryptionAvailable()
  })

  ipcMain.handle(IpcChannels.VAULT_REVEAL_SECRET, (_event, input: unknown) => {
    const { credentialRef } = RevealSecretInputSchema.parse(input)
    assertCredentialOwnership(repos, credentialRef)
    if (!vault.hasSecret(credentialRef)) {
      throw new Error('Secret not found')
    }
    return vault.resolveSecret(credentialRef)
  })
}
