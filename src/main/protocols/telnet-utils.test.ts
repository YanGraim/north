import { describe, expect, it } from 'vitest'
import { TELNET, TELNET_OPT, TelnetParser } from './telnet-utils'

describe('TelnetParser', () => {
  it('passes through plain data', () => {
    const parser = new TelnetParser()
    const input = new TextEncoder().encode('hello')
    const result = parser.process(input)
    expect(new TextDecoder().decode(result.data)).toBe('hello')
    expect(result.response.length).toBe(0)
  })

  it('accepts WILL ECHO with DO', () => {
    const parser = new TelnetParser()
    const input = Uint8Array.from([TELNET.IAC, TELNET.WILL, TELNET_OPT.ECHO, 65])
    const result = parser.process(input)
    expect(result.data).toEqual(Uint8Array.from([65]))
    expect(result.response).toEqual(Uint8Array.from([TELNET.IAC, TELNET.DO, TELNET_OPT.ECHO]))
  })

  it('refuses unknown DO options with WONT', () => {
    const parser = new TelnetParser()
    const input = Uint8Array.from([TELNET.IAC, TELNET.DO, TELNET_OPT.TERMINAL_TYPE])
    const result = parser.process(input)
    expect(result.data.length).toBe(0)
    expect(result.response).toEqual(
      Uint8Array.from([TELNET.IAC, TELNET.WONT, TELNET_OPT.TERMINAL_TYPE])
    )
  })

  it('accepts suppress go-ahead', () => {
    const parser = new TelnetParser()
    const input = Uint8Array.from([TELNET.IAC, TELNET.WILL, TELNET_OPT.SUPPRESS_GO_AHEAD])
    const result = parser.process(input)
    expect(result.response).toEqual(
      Uint8Array.from([TELNET.IAC, TELNET.DO, TELNET_OPT.SUPPRESS_GO_AHEAD])
    )
  })
})
