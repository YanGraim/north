import type { ApiSendInput, ApiSendResult } from '@shared/protocols'
import { emptyApiConfig } from '@shared/types'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'
import { type BuiltApiRequest, buildApiRequest } from './build-request'
import { executeHttpRequest } from './http-client'

const abortControllers = new Map<string, AbortController>()

export function abortApiSend(requestId: string): void {
  abortControllers.get(requestId)?.abort()
}

export function clientIdForAccess(repos: Repositories, accessId: string): string | null {
  const access = repos.accesses.get(accessId)
  if (!access) return null
  const group = repos.groups.get(access.groupId)
  if (!group) return null
  const environment = repos.environments.get(group.environmentId)
  return environment?.clientId ?? null
}

function maskSecrets(echoed: ApiSendResult['echoed'], secrets: string[]): ApiSendResult['echoed'] {
  const unique = secrets.filter((secret) => secret.length > 0)
  if (unique.length === 0) return echoed
  const mask = (text: string): string => {
    let next = text
    for (const secret of unique) {
      next = next.split(secret).join('***')
    }
    return next
  }
  return {
    method: echoed.method,
    url: mask(echoed.url),
    headers: echoed.headers.map((header) => ({
      key: header.key,
      value: mask(header.value)
    }))
  }
}

function failedResult(input: ApiSendInput, message: string): ApiSendResult {
  return {
    requestId: input.requestId,
    status: null,
    statusText: '',
    headers: [],
    bodyText: '',
    truncated: false,
    durationMs: 0,
    sizeBytes: 0,
    errorKind: 'invalid-url',
    errorMessage: message,
    echoed: { method: input.method, url: input.url, headers: [] }
  }
}

function recordHistory(
  repos: Repositories,
  accessId: string,
  input: ApiSendInput,
  result: ApiSendResult
): void {
  try {
    repos.apiRequestHistory.insert({
      accessId,
      requestId: input.persistedRequestId ?? null,
      method: input.method,
      url: result.echoed.url,
      statusCode: result.status,
      durationMs: Math.round(result.durationMs),
      sizeBytes: result.sizeBytes,
      errorKind: result.errorKind,
      errorMessage: result.errorMessage
    })
  } catch {
    // history must not break send
  }
}

export async function executeApiSend(
  repos: Repositories,
  vault: CredentialVault,
  input: ApiSendInput
): Promise<ApiSendResult> {
  const environment = repos.accesses.get(input.environmentAccessId)
  if (environment?.type !== 'api') {
    throw new Error('Ambiente inválido')
  }

  if (input.collectionId) {
    const collection = repos.apiCollections.getCollection(input.collectionId)
    if (!collection) {
      throw new Error('Collection não encontrada')
    }
    if (collection.clientId) {
      const envClient = clientIdForAccess(repos, environment.id)
      if (envClient !== collection.clientId) {
        throw new Error('O ambiente precisa ser um Access API do mesmo cliente')
      }
    }
  }

  const variables: Record<string, string> = {
    ...repos.groupVariables.toRecord(environment.groupId)
  }
  const secrets: string[] = []
  for (const variable of repos.apiVariables.listByAccess(environment.id)) {
    if (variable.isSecret) {
      if (variable.credentialRef) {
        const secret = vault.resolveSecret(variable.credentialRef)
        variables[variable.key] = secret
        secrets.push(secret)
      }
    } else if (variable.value !== null) {
      variables[variable.key] = variable.value
    }
  }
  if (environment.url?.trim() && !Object.hasOwn(variables, 'baseUrl')) {
    variables.baseUrl = environment.url.trim()
  }

  const apiConfig = environment.apiConfig ?? emptyApiConfig()
  const timeoutMs = apiConfig.timeoutMs === 30_000 ? 0 : apiConfig.timeoutMs
  let built: BuiltApiRequest
  try {
    built = buildApiRequest({
      definition: input.definition,
      apiConfig,
      baseUrl: environment.url ?? '',
      method: input.method,
      url: input.url,
      variables
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'URL inválida'
    const failed = failedResult(input, message)
    recordHistory(repos, environment.id, input, failed)
    return failed
  }

  const controller = new AbortController()
  abortControllers.set(input.requestId, controller)
  try {
    const result = await executeHttpRequest({
      url: built.url,
      method: built.method,
      headers: built.headers,
      body: built.body,
      timeoutMs,
      followRedirects: apiConfig.followRedirects,
      verifyTls: apiConfig.verifyTls,
      signal: controller.signal,
      requestId: input.requestId
    })
    const masked: ApiSendResult = {
      ...result,
      echoed: maskSecrets(result.echoed, secrets)
    }
    recordHistory(repos, environment.id, input, masked)
    return masked
  } finally {
    abortControllers.delete(input.requestId)
  }
}
