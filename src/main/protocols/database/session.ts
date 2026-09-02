import type {
  DatabaseCapability,
  DatabaseTxState,
  ProtocolSession,
  SessionDataPort,
  SessionKind,
  SessionState
} from '@shared/protocols'
import { queryLimits } from './config'
import type { DatabaseAdapter } from './types'

export class DatabaseProtocolSession implements ProtocolSession {
  readonly kind: SessionKind = 'database'
  state: SessionState = 'connecting'
  readonly database: DatabaseCapability

  constructor(
    readonly id: string,
    readonly protocol: string,
    private readonly adapter: DatabaseAdapter
  ) {
    this.database = {
      introspect: () => this.adapter.introspect(),
      query: (sql: string, options?: { maxRows: number; timeoutMs: number }) =>
        this.adapter.query(sql, options ?? queryLimits),
      cancel: () => this.adapter.cancel(),
      getTxState: (): DatabaseTxState => this.adapter.getTxState(),
      setAutoCommit: (on: boolean) => this.adapter.setAutoCommit(on),
      commit: () => this.adapter.commit(),
      rollback: () => this.adapter.rollback()
    }
  }

  attachPort(_port: SessionDataPort): void {
    // Database I/O uses typed IPC (db:*), not the MessagePort byte stream.
  }

  async dispose(): Promise<void> {
    this.state = 'closed'
    await this.adapter.dispose()
  }
}
