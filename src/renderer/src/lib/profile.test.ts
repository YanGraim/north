import { describe, expect, it } from 'vitest'
import { effectiveDisplayName, profileInitials } from './profile'

describe('profileInitials', () => {
  it('uses two letters from a single word', () => {
    expect(profileInitials('north')).toBe('NO')
  })

  it('uses first and last name initials', () => {
    expect(profileInitials('Ana Silva')).toBe('AS')
  })
})

describe('effectiveDisplayName', () => {
  it('prefers stored display name', () => {
    expect(effectiveDisplayName('Custom', 'os-user')).toBe('Custom')
  })

  it('falls back to OS username', () => {
    expect(effectiveDisplayName('', 'os-user')).toBe('os-user')
  })
})
