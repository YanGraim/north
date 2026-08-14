import { describe, expect, it } from 'vitest'
import {
  AUTO_COMMIT_BLOCKED_MESSAGE,
  beginTransactionSql,
  commitTransactionSql,
  rollbackTransactionSql,
  TransactionController
} from './tx'

describe('transaction SQL helpers', () => {
  it('uses engine-specific BEGIN', () => {
    expect(beginTransactionSql('postgres')).toBe('BEGIN')
    expect(beginTransactionSql('sqlite')).toBe('BEGIN')
    expect(beginTransactionSql('mysql')).toBe('START TRANSACTION')
    expect(beginTransactionSql('mariadb')).toBe('START TRANSACTION')
    expect(beginTransactionSql('mssql')).toBe('BEGIN TRANSACTION')
  })

  it('uses COMMIT / ROLLBACK for all engines', () => {
    expect(commitTransactionSql('postgres')).toBe('COMMIT')
    expect(rollbackTransactionSql('mssql')).toBe('ROLLBACK')
  })
})

describe('TransactionController', () => {
  it('defaults to auto-commit with no open transaction', () => {
    const tx = new TransactionController()
    expect(tx.getState()).toEqual({ autoCommit: true, inTransaction: false })
    expect(tx.beginSqlIfNeeded('postgres')).toBeNull()
  })

  it('emits BEGIN when auto-commit is off and no transaction is open', () => {
    const tx = new TransactionController()
    tx.setAutoCommit(false)
    expect(tx.beginSqlIfNeeded('postgres')).toBe('BEGIN')
    expect(tx.beginSqlIfNeeded('mysql')).toBe('START TRANSACTION')
    tx.markInTransaction()
    expect(tx.beginSqlIfNeeded('postgres')).toBeNull()
    expect(tx.getState()).toEqual({ autoCommit: false, inTransaction: true })
  })

  it('blocks turning auto-commit on while a transaction is open', () => {
    const tx = new TransactionController()
    tx.setAutoCommit(false)
    tx.markInTransaction()
    expect(() => tx.setAutoCommit(true)).toThrow(AUTO_COMMIT_BLOCKED_MESSAGE)
    tx.markIdle()
    tx.setAutoCommit(true)
    expect(tx.getState()).toEqual({ autoCommit: true, inTransaction: false })
  })

  it('reports dispose rollback when a transaction is open', () => {
    const tx = new TransactionController()
    expect(tx.needsRollbackOnDispose()).toBe(false)
    tx.setAutoCommit(false)
    tx.markInTransaction()
    expect(tx.needsRollbackOnDispose()).toBe(true)
  })
})
