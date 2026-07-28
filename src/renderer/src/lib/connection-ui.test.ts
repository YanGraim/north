import { Globe, Terminal } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { connectionDisplayIcon, protocolIcon } from './connection-ui'

describe('connectionDisplayIcon', () => {
  it('uses the custom icon when set', () => {
    const Icon = connectionDisplayIcon({ protocol: 'ssh', icon: 'globe' })
    expect(Icon).toBe(Globe)
  })

  it('falls back to the protocol icon when custom icon is null', () => {
    const Icon = connectionDisplayIcon({ protocol: 'ssh', icon: null })
    expect(Icon).toBe(protocolIcon('ssh'))
    expect(Icon).toBe(Terminal)
  })
})
