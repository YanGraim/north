export const REDACTED = '‹redacted›'

const MANAGEMENT_CREDENTIAL = /^(\s*(?:password|username)\s+"[^"]*"\s+)"(?:[^"\\]|\\.)*"/gim
const PEM_BODY = /(-----BEGIN [^-]+-----)[\s\S]*?(-----END [^-]+-----)/g

/**
 * Build a log-line scrubber for a VPN session. Known secrets (passwords, PSK,
 * key passphrase) are removed verbatim; management credential commands and PEM
 * bodies are masked structurally even if the secret isn't known.
 */
export function createRedactor(secrets: string[]): (line: string) => string {
  const known = [...new Set(secrets.filter((s) => s.length >= 3))].sort(
    (a, b) => b.length - a.length
  )
  const pattern = known.length
    ? new RegExp(known.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
    : null
  return (line) => {
    let out = line
      .replace(MANAGEMENT_CREDENTIAL, `$1"${REDACTED}"`)
      .replace(PEM_BODY, `$1\n${REDACTED}\n$2`)
    if (pattern) out = out.replace(pattern, REDACTED)
    return out
  }
}
