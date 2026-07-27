/**
 * Telnet control bytes (RFC 854 + friends).
 */
export const TELNET = {
  IAC: 0xff,
  DONT: 0xfe,
  DO: 0xfd,
  WONT: 0xfc,
  WILL: 0xfb,
  SB: 0xfa,
  SE: 0xf0,
  NOP: 0xf1
} as const

export const TELNET_OPT = {
  ECHO: 0x01,
  SUPPRESS_GO_AHEAD: 0x03,
  TERMINAL_TYPE: 0x18,
  NAWS: 0x1f
} as const

export type TelnetProcessResult = {
  /** Data bytes to forward to the terminal. */
  data: Uint8Array
  /** Bytes that must be written back to the socket in response. */
  response: Uint8Array
}

type ParserState = 'normal' | 'iac' | 'will' | 'wont' | 'do' | 'dont' | 'sb' | 'sb-iac'

/**
 * Minimal Telnet IAC parser. Strips control sequences from the byte stream
 * and negotiates a few options so most modern telnet servers get a working
 * NVT session:
 *   - accepts server WILL SGA/ECHO
 *   - refuses everything else the server tries to make us do
 *   - agrees to NAWS when the server asks, so terminal resize can be reported
 */
export class TelnetParser {
  private state: ParserState = 'normal'
  private subneg: number[] = []
  private nawsEnabled = false

  process(chunk: Uint8Array): TelnetProcessResult {
    const data: number[] = []
    const response: number[] = []

    for (const byte of chunk) {
      switch (this.state) {
        case 'normal':
          if (byte === TELNET.IAC) {
            this.state = 'iac'
          } else {
            data.push(byte)
          }
          break

        case 'iac':
          if (byte === TELNET.IAC) {
            data.push(TELNET.IAC)
            this.state = 'normal'
          } else if (byte === TELNET.WILL) {
            this.state = 'will'
          } else if (byte === TELNET.WONT) {
            this.state = 'wont'
          } else if (byte === TELNET.DO) {
            this.state = 'do'
          } else if (byte === TELNET.DONT) {
            this.state = 'dont'
          } else if (byte === TELNET.SB) {
            this.state = 'sb'
            this.subneg = []
          } else {
            this.state = 'normal'
          }
          break

        case 'will':
          if (byte === TELNET_OPT.SUPPRESS_GO_AHEAD || byte === TELNET_OPT.ECHO) {
            response.push(TELNET.IAC, TELNET.DO, byte)
          } else {
            response.push(TELNET.IAC, TELNET.DONT, byte)
          }
          this.state = 'normal'
          break

        case 'wont':
          response.push(TELNET.IAC, TELNET.DONT, byte)
          this.state = 'normal'
          break

        case 'do':
          if (byte === TELNET_OPT.NAWS) {
            this.nawsEnabled = true
            response.push(TELNET.IAC, TELNET.WILL, TELNET_OPT.NAWS)
          } else if (byte === TELNET_OPT.SUPPRESS_GO_AHEAD) {
            response.push(TELNET.IAC, TELNET.WILL, TELNET_OPT.SUPPRESS_GO_AHEAD)
          } else {
            response.push(TELNET.IAC, TELNET.WONT, byte)
          }
          this.state = 'normal'
          break

        case 'dont':
          response.push(TELNET.IAC, TELNET.WONT, byte)
          this.state = 'normal'
          break

        case 'sb':
          if (byte === TELNET.IAC) {
            this.state = 'sb-iac'
          } else {
            this.subneg.push(byte)
          }
          break

        case 'sb-iac':
          if (byte === TELNET.SE) {
            this.subneg = []
            this.state = 'normal'
          } else if (byte === TELNET.IAC) {
            this.subneg.push(TELNET.IAC)
            this.state = 'sb'
          } else {
            this.subneg = []
            this.state = 'normal'
          }
          break
      }
    }

    return {
      data: Uint8Array.from(data),
      response: Uint8Array.from(response)
    }
  }

  /** True once the server agreed to receive NAWS updates. */
  get supportsNaws(): boolean {
    return this.nawsEnabled
  }

  /** Force-enable NAWS reporting (useful for tests). */
  enableNaws(): void {
    this.nawsEnabled = true
  }
}

/**
 * Build a NAWS subnegotiation payload (`IAC SB NAWS w1 w0 h1 h0 IAC SE`).
 * Any 0xFF byte in the four size bytes must be doubled to preserve framing.
 * Returns an empty Uint8Array when NAWS is not enabled.
 */
export function buildNawsPayload(cols: number, rows: number, nawsEnabled: boolean): Uint8Array {
  if (!nawsEnabled) return new Uint8Array()
  const safeCols = Math.max(0, Math.min(0xffff, Math.floor(cols)))
  const safeRows = Math.max(0, Math.min(0xffff, Math.floor(rows)))
  const bytes = [(safeCols >> 8) & 0xff, safeCols & 0xff, (safeRows >> 8) & 0xff, safeRows & 0xff]
  const payload: number[] = [TELNET.IAC, TELNET.SB, TELNET_OPT.NAWS]
  for (const byte of bytes) {
    payload.push(byte)
    if (byte === TELNET.IAC) payload.push(TELNET.IAC)
  }
  payload.push(TELNET.IAC, TELNET.SE)
  return Uint8Array.from(payload)
}

/**
 * Escape a data payload so any legitimate 0xFF byte does not look like a
 * command introducer to the server.
 */
export function escapeTelnetData(data: Uint8Array): Uint8Array {
  let hasIac = false
  for (const byte of data) {
    if (byte === TELNET.IAC) {
      hasIac = true
      break
    }
  }
  if (!hasIac) return data

  const out: number[] = []
  for (const byte of data) {
    out.push(byte)
    if (byte === TELNET.IAC) out.push(TELNET.IAC)
  }
  return Uint8Array.from(out)
}
