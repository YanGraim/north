#!/usr/bin/env node
// Fake strongSwan charon-cmd for driver tests. Scenario = --xauth-username:
//   ok | auth | proposal | silent | unreachable. Expects PSK "psk-ok" then password "pw-ok" on stdin.
const argv = process.argv.slice(2)
const arg = (name) => argv[argv.indexOf(name) + 1]
const out = (l) => process.stdout.write(`${l}\n`)
const scenario = arg('--xauth-username')
let input = ''
process.stdin.on('data', (c) => {
  input += c
})
process.stdin.on('end', () => {
  const [psk, password] = input.split('\n')
  if (!argv.includes('--identity')) {
    out('unable to initiate, missing --identity option')
    process.exit(1)
  }
  out(`initiating Aggressive Mode IKE_SA cmd[1] to ${arg('--host')}`)
  if (scenario === 'silent') return setInterval(() => {}, 1000)
  if (scenario === 'unreachable') {
    out('giving up after 5 retransmits')
    out("establishing connection 'cmd' failed")
    process.exit(1)
  }
  if (scenario === 'proposal') {
    out('received NO_PROPOSAL_CHOSEN error notify')
    process.exit(1)
  }
  if (psk !== 'psk-ok' || password !== 'pw-ok' || scenario === 'auth') {
    out("XAuth authentication of 'x' (myself) failed")
    process.exit(1)
  }
  out(`IKE_SA cmd[1] established between 192.168.0.10[192.168.0.10]...${arg('--host')}`)
  out('installing new virtual IP 10.10.20.5')
  out(
    'CHILD_SA cmd{1} established with SPIs c1d2e3f4_i 0a0b0c0d_o and TS 10.10.20.5/32 === 0.0.0.0/0'
  )
  process.on('SIGTERM', () => {
    out('deleting IKE_SA cmd[1]')
    process.exit(0)
  })
  setInterval(() => {}, 1000)
})
