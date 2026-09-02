import type { ApiSendResult } from '@shared/protocols'
import type { ApiHttpMethod, ApiRequestDefinition } from '@shared/types'
import { emptyApiRequestDefinition } from '@shared/types'

export type ApiStudioTab = {
  id: string
  requestId: string | null
  name: string
  method: ApiHttpMethod
  url: string
  definition: ApiRequestDefinition
  dirty: boolean
  response: ApiSendResult | null
  error: string | null
  sending: boolean
  inFlightRequestId: string | null
}

export function emptyScratchTab(name = 'Nova request'): ApiStudioTab {
  return {
    id: crypto.randomUUID(),
    requestId: null,
    name,
    method: 'GET',
    url: '',
    definition: emptyApiRequestDefinition(),
    dirty: false,
    response: null,
    error: null,
    sending: false,
    inFlightRequestId: null
  }
}

export function neighborTabId(
  tabs: ApiStudioTab[],
  closedId: string,
  activeId: string | null
): string | null {
  if (activeId !== closedId) return activeId
  const index = tabs.findIndex((tab) => tab.id === closedId)
  const next = tabs[index + 1] ?? tabs[index - 1]
  return next?.id ?? null
}
