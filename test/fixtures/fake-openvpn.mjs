#!/usr/bin/env node
// Fake `openvpn` for driver contract tests — speaks enough of the management
// protocol to exercise the real OpenVpnDriver without root or a server.
//
// Scenario and record path come from comments inside the --config file:
//   # fake-scenario: ok | auth-failed | slow | crash | drop
//   # fake-record: /abs/path/record.json
// Expected secrets: password "pw-ok", key passphrase "key-ok".
import { appendFileSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const argv = process.argv.slice(2)
const argAfter = (flag, n = 1) => {
  const i = argv.indexOf(flag)
  return i === -1 ? [] : argv.slice(i + 1, i + 1 + n)
}

const [configPath] = argAfter('--config')
const [mgmtHost, mgmtPort, mgmtPwFile] = argAfter('--management', 3)
const config = readFileSync(configPath, 'utf8')
const scenario = /# fake-scenario: (\S+)/.exec(config)?.[1] ?? 'ok'
const recordPath = /# fake-record: (\S+)/.exec(config)?.[1]
const needsAuth = /^auth-user-pass$/m.test(config)
const needsKey = /ENCRYPTED/.test(config)
const mgmtPassword = readFileSync(mgmtPwFile, 'utf8').trim()

const record = (entry) => {
  if (recordPath) appendFileSync(recordPath, `${JSON.stringify(entry)}\n`)
}
record({ argv, env: process.env, config })

const creds = {}
let socket = null
const send = (line) => socket?.write(`${line}\r\n`)
const now = () => Math.floor(Date.now() / 1000)

function maybeContinue() {
  if (needsKey && creds.key === undefined) return
  if (needsKey && creds.key !== 'key-ok') {
    send(">PASSWORD:Verification Failed: 'Private Key'")
    return setTimeout(() => process.exit(1), 20)
  }
  if (needsAuth && (creds.user === undefined || creds.pass === undefined)) {
    if (!creds.askedAuth) {
      creds.askedAuth = true
      send(">PASSWORD:Need 'Auth' username/password")
    }
    return
  }
  if (needsAuth && (scenario === 'auth-failed' || creds.pass !== 'pw-ok')) {
    send(">PASSWORD:Verification Failed: 'Auth'")
    return setTimeout(() => process.exit(1), 20)
  }
  if (creds.connected) return
  creds.connected = true
  send(
    `>LOG:${now()},,PUSH: Received control message: 'PUSH_REPLY,route 10.20.0.0 255.255.0.0,ifconfig 10.8.0.6 255.255.255.0'`
  )
  send(`>STATE:${now()},CONNECTED,SUCCESS,10.8.0.6,203.0.113.10,1194,,`)
  if (scenario === 'drop') setTimeout(() => process.exit(1), 150)
}

function startFlow() {
  send(`>STATE:${now()},RESOLVE,,,,,,`)
  if (scenario === 'slow') return
  if (scenario === 'crash') return setTimeout(() => process.exit(3), 20)
  if (needsKey) send(">PASSWORD:Need 'Private Key' password")
  else maybeContinue()
}

const server = createServer((s) => {
  socket = s
  let authed = false
  let buf = ''
  s.write('ENTER PASSWORD:')
  s.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      record({ cmd: line })
      if (!authed) {
        if (line !== mgmtPassword) {
          s.end('ERROR: bad password\r\n')
          return
        }
        authed = true
        send('SUCCESS: password is correct')
        send('>INFO:OpenVPN Management Interface Version 5 -- fake')
        send('>HOLD:Waiting for hold release:0')
        continue
      }
      const m = /^(username|password) "([^"]+)" "((?:[^"\\]|\\.)*)"$/.exec(line)
      if (m) {
        const value = m[3].replace(/\\(.)/g, '$1')
        if (m[2] === 'Private Key') creds.key = value
        else if (m[1] === 'username') creds.user = value
        else creds.pass = value
        send(`SUCCESS: '${m[2]}' ${m[1]} entered, but not yet verified`)
        maybeContinue()
      } else if (line === 'hold release') {
        send('SUCCESS: hold release succeeded')
        startFlow()
      } else if (line === 'pid') {
        send(`SUCCESS: pid=${process.pid}`)
      } else if (line === 'signal SIGTERM') {
        send('SUCCESS: signal SIGTERM thrown')
        send(`>STATE:${now()},EXITING,SIGTERM,,,,,`)
        setTimeout(() => process.exit(0), 10)
      } else {
        send(`SUCCESS: ${line}`)
      }
    }
  })
})

server.listen(Number(mgmtPort), mgmtHost)
process.on('SIGTERM', () => process.exit(0))
