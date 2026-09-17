import { describe, expect, it } from 'vitest'
import {
  autoSelectAccessId,
  CREATE_ENVIRONMENT,
  NO_ENVIRONMENT,
  toSendAccessId
} from './environment-select'

const one = { id: '11111111-1111-1111-1111-111111111111' }
const two = { id: '22222222-2222-2222-2222-222222222222' }

describe('toSendAccessId', () => {
  it('returns undefined for the no-environment sentinel', () => {
    expect(toSendAccessId(NO_ENVIRONMENT)).toBeUndefined()
  })

  it('returns undefined for the create-environment sentinel', () => {
    expect(toSendAccessId(CREATE_ENVIRONMENT)).toBeUndefined()
  })

  it('returns the uuid otherwise', () => {
    expect(toSendAccessId(one.id)).toBe(one.id)
  })
})

describe('autoSelectAccessId', () => {
  it('selects the only access when the UI is on no-environment', () => {
    expect(autoSelectAccessId([one], NO_ENVIRONMENT)).toBe(one.id)
  })

  it('does not auto-select when there is more than one access', () => {
    expect(autoSelectAccessId([one, two], NO_ENVIRONMENT)).toBeNull()
  })

  it('is idempotent when an access is already selected', () => {
    expect(autoSelectAccessId([one], one.id)).toBeNull()
  })
})
