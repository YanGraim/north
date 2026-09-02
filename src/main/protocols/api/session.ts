import type {
  ApiCapability,
  ProtocolSession,
  SessionDataPort,
  SessionKind,
  SessionState
} from '@shared/protocols'
import type { Repositories } from '../../repositories'
import type { CredentialVault } from '../../vault'
import { abortApiSend, executeApiSend } from './execute-send'

export class ApiProtocolSession implements ProtocolSession {
  readonly kind: SessionKind = 'api'
  readonly protocol = 'api'
  state: SessionState = 'connecting'
  readonly api: ApiCapability

  constructor(
    readonly id: string,
    _originAccessId: string,
    private readonly repos: Repositories,
    private readonly vault: CredentialVault
  ) {
    this.api = {
      send: (input) => executeApiSend(this.repos, this.vault, input),
      cancel: (requestId) => abortApiSend(requestId)
    }
  }

  attachPort(_port: SessionDataPort): void {
    // API I/O uses typed IPC (api:*), not the MessagePort byte stream.
  }

  async dispose(): Promise<void> {
    this.state = 'closed'
  }
}
