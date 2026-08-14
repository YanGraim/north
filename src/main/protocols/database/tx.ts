import type { DatabaseTxState, SqlStudioEngine } from '@shared/protocols'

export const AUTO_COMMIT_BLOCKED_MESSAGE =
  'Finalize a transação com Commit ou Rollback antes de religar o auto-commit'

export function beginTransactionSql(engine: SqlStudioEngine): string {
  switch (engine) {
    case 'mssql':
      return 'BEGIN TRANSACTION'
    case 'mysql':
    case 'mariadb':
      return 'START TRANSACTION'
    default:
      return 'BEGIN'
  }
}

export function commitTransactionSql(_engine: SqlStudioEngine): string {
  return 'COMMIT'
}

export function rollbackTransactionSql(_engine: SqlStudioEngine): string {
  return 'ROLLBACK'
}

/** Session-level auto-commit / open-transaction state for SQL studio adapters. */
export class TransactionController {
  private autoCommit = true
  private inTransaction = false

  getState(): DatabaseTxState {
    return { autoCommit: this.autoCommit, inTransaction: this.inTransaction }
  }

  /** SQL to start a transaction before the next user statement, or null. */
  beginSqlIfNeeded(engine: SqlStudioEngine): string | null {
    if (this.autoCommit || this.inTransaction) return null
    return beginTransactionSql(engine)
  }

  markInTransaction(): void {
    this.inTransaction = true
  }

  setAutoCommit(on: boolean): void {
    if (on && this.inTransaction) {
      throw new Error(AUTO_COMMIT_BLOCKED_MESSAGE)
    }
    this.autoCommit = on
  }

  markIdle(): void {
    this.inTransaction = false
  }

  needsRollbackOnDispose(): boolean {
    return this.inTransaction
  }
}
