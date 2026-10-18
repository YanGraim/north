/**
 * Pure parser for strongSwan charon-cmd output, plus the helper's stdin builder.
 * Proposals match FortiClient's defaults for a FortiGate dial-up tunnel
 * (AES128/AES256 · SHA1/SHA256 · DH 5 in phase 1; AES · SHA1 · PFS DH 5 in phase 2).
 */
export const FORTICLIENT_IKE_PROPOSAL = 'aes128-aes256-sha256-sha1-modp1536'
export const FORTICLIENT_ESP_PROPOSAL = 'aes128-aes256-sha1-modp1536'

export type StrongswanEvent =
  | { type: 'up' }
  | { type: 'address'; ip: string }
  | { type: 'auth-failed' }
  | { type: 'no-proposal' }
  | { type: 'unreachable'; message: string }
  | { type: 'error'; message: string }
  | { type: 'other'; line: string }

export function parseStrongswanLine(raw: string): StrongswanEvent {
  const line = raw.trim()
  if (/CHILD_SA \S+ established/.test(line)) return { type: 'up' }
  const vip = /installing new virtual IP ([0-9.]+)/.exec(line)
  if (vip) return { type: 'address', ip: vip[1] }
  if (/NO_PROPOSAL_CHOSEN|no (matching )?proposal (found|chosen)/i.test(line)) {
    return { type: 'no-proposal' }
  }
  if (
    /AUTHENTICATION_FAILED|XAuth authentication of .* failed|verification of .* failed|INVALID_HASH_INFORMATION|PSK mismatch/i.test(
      line
    )
  ) {
    return { type: 'auth-failed' }
  }
  if (/giving up after \d+ retransmits|unable to resolve|no route to host/i.test(line)) {
    return { type: 'unreachable', message: line }
  }
  if (/establishing .* failed|initiate failed|failed to/i.test(line)) {
    return { type: 'error', message: line }
  }
  return { type: 'other', line }
}

const SAFE = /^[A-Za-z0-9.:_@-]+$/

/** key=value lines for `north-vpn-helper ipsec` — the helper re-validates all of it as root. */
export function buildIpsecHelperInput(input: {
  gateway: string
  username: string
  groupName?: string
  psk: string
  password: string
  ike?: string
  esp?: string
}): string {
  for (const [label, value] of [
    ['gateway', input.gateway],
    ['username', input.username],
    ...(input.groupName ? [['groupName', input.groupName]] : [])
  ]) {
    if (!SAFE.test(value) || value.startsWith('-')) {
      throw new Error(`Caractere não suportado em ${label}`)
    }
  }
  if (/[\r\n]/.test(input.psk) || /[\r\n]/.test(input.password)) {
    throw new Error('Configuration values must not contain line breaks')
  }
  return [
    `host=${input.gateway}`,
    `user=${input.username}`,
    ...(input.groupName ? [`id=${input.groupName}`] : []),
    `psk=${input.psk}`,
    `password=${input.password}`,
    `ike=${input.ike ?? FORTICLIENT_IKE_PROPOSAL}`,
    `esp=${input.esp ?? FORTICLIENT_ESP_PROPOSAL}`,
    ''
  ].join('\n')
}
