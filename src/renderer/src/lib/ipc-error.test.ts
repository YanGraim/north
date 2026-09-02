import { describe, expect, it } from 'vitest'
import { formatIpcError } from './ipc-error'

describe('formatIpcError', () => {
  it('does not dump Zod issue JSON to the user', () => {
    const dump =
      'Error invoking remote method \'api:collection-create\': [{"expected":"string","code":"invalid_type","path":["accessId"],"message":"Invalid input: expected string, received undefined"}]'
    expect(formatIpcError(new Error(dump), 'Não foi possível criar a collection')).toBe(
      'Não foi possível criar a collection'
    )
  })
})
