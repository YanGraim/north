import type { ListAccessesFilter, ListConnectionsFilter } from '@shared/types'
import type { Repositories } from '../repositories'
import type { CredentialVault } from '../vault'

/** Delete vault secrets for every connection matching the filter (before cascade delete). */
export function deleteSecretsForConnections(
  repos: Repositories,
  vault: CredentialVault,
  filter: ListConnectionsFilter
): void {
  const connections = repos.connections.list(filter)
  for (const connection of connections) {
    if (connection.credentialRef) {
      vault.deleteSecret(connection.credentialRef)
    }
  }
}

/** Delete vault secrets for a single access (credential + API variable secrets). */
export function deleteSecretsForAccess(
  repos: Repositories,
  vault: CredentialVault,
  access: { id: string; credentialRef: string | null }
): void {
  if (access.credentialRef) {
    vault.deleteSecret(access.credentialRef)
  }
  for (const variable of repos.apiVariables.listByAccess(access.id)) {
    if (variable.credentialRef) {
      vault.deleteSecret(variable.credentialRef)
    }
  }
}

/** Delete vault secrets for every access matching the filter (before cascade delete). */
export function deleteSecretsForAccesses(
  repos: Repositories,
  vault: CredentialVault,
  filter: ListAccessesFilter
): void {
  const accesses = repos.accesses.list(filter)
  for (const access of accesses) {
    deleteSecretsForAccess(repos, vault, access)
  }
}

export function deleteSecretsForScope(
  repos: Repositories,
  vault: CredentialVault,
  filter: ListConnectionsFilter & ListAccessesFilter
): void {
  deleteSecretsForConnections(repos, vault, filter)
  deleteSecretsForAccesses(repos, vault, filter)
}
