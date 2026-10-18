#!/usr/bin/env node
// Fake openfortivpn for driver tests. Scenario = the username in the -c config:
//   ok | auth | cert | drop | slow | silent | refused. Expected password "pw-ok". Trusts only digest "a"*64.
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const cfgPath = argv[argv.indexOf('-c') + 1]
const cfg = Object.fromEntries(
  readFileSync(cfgPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(' = '))
)
const out = (l) => process.stdout.write(`${l}\n`)
const scenario = cfg.username
const DIGEST = 'a'.repeat(64)

if (scenario === 'silent') {
  // a filtered port: nothing ever answers
  setInterval(() => {}, 1000)
  await new Promise(() => {})
}
out(`INFO:   Connected to gateway ${cfg.host}:${cfg.port}`)
if (cfg.host.includes(':')) {
  out('ERROR:  getaddrinfo: nodename nor servname provided, or not known')
  process.exit(1)
}
if (scenario === 'refused') {
  out('ERROR:  connect: Connection refused')
  process.exit(1)
}
if (cfg['trusted-cert'] !== DIGEST && scenario === 'cert') {
  out(
    'ERROR:  Gateway certificate validation failed, and the certificate digest is not in the local whitelist. If you trust it, rerun with:'
  )
  out(`ERROR:      --trusted-cert ${DIGEST}`)
  process.exit(1)
}
if (scenario === 'slow') {
  setInterval(() => {}, 1000)
} else if (scenario === 'auth' || cfg.password !== 'pw-ok') {
  out(
    'ERROR:  Could not authenticate to gateway. Please check the password, client certificate, etc.'
  )
  process.exit(1)
} else {
  out('INFO:   Authenticated.')
  out('INFO:   Got addresses: [10.212.134.200], ns [10.0.0.1, 0.0.0.0]')
  out('INFO:   Tunnel is up and running.')
  if (scenario === 'drop') setTimeout(() => process.exit(1), 300)
  else setInterval(() => {}, 1000)
}
process.on('SIGTERM', () => {
  out('INFO:   Tunnel is down.')
  process.exit(0)
})
