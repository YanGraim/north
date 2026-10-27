import { readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { ConnectOptions } from '@shared/protocols'
import type { Client, ConnectConfig, Prompt } from 'ssh2'
import { fingerprintHostKey, parseHostKeyType, parseSshConnectionConfig } from './ssh-utils'

/**
 * Many OpenSSH servers offer `keyboard-interactive` (PAM) instead of `password`.
 * The CLI handles both; ssh2 needs tryKeyboard + this handler.
 */
export function attachKeyboardInteractivePassword(client: Client, password: string): void {
  client.on(
    'keyboard-interactive',
    (
      _name: string,
      _instructions: string,
      _instructionsLang: string,
      prompts: Prompt[],
      finish: (responses: string[]) => void
    ) => {
      finish(prompts.map(() => password))
    }
  )
}

const AGENT_UNAVAILABLE_MESSAGE =
  process.platform === 'win32'
    ? 'SSH agent indisponível. Habilite o serviço "OpenSSH Authentication Agent" e rode ssh-add.'
    : 'SSH agent indisponível (SSH_AUTH_SOCK não definido). Rode ssh-add num terminal.'

function expandHome(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2))
  }
  return filePath
}

/** Windows' built-in OpenSSH Authentication Agent listens here (no SSH_AUTH_SOCK is set). */
export const WINDOWS_OPENSSH_AGENT_PIPE = '\\\\.\\pipe\\openssh-ssh-agent'

/**
 * Whether something answers on a socket/named pipe. `fs.existsSync` is not a
 * reliable test for Windows named pipes, so actually connect (and hang up).
 */
export function canConnectToAgent(path: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(path)
    const done = (ok: boolean): void => {
      clearTimeout(timer)
      socket.destroy()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/**
 * Where the local ssh-agent lives, the way OpenSSH finds it: SSH_AUTH_SOCK
 * first, then (Windows) the OpenSSH agent's named pipe.
 */
export async function resolveLocalSshAgent(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  reachable: (path: string) => Promise<boolean> = canConnectToAgent
): Promise<string | null> {
  if (env.SSH_AUTH_SOCK) return env.SSH_AUTH_SOCK
  if (platform === 'win32' && (await reachable(WINDOWS_OPENSSH_AGENT_PIPE))) {
    return WINDOWS_OPENSSH_AGENT_PIPE
  }
  return null
}

export async function buildSshConnectConfig(opts: ConnectOptions): Promise<ConnectConfig> {
  const { connection, resolveSecret, verifyHostKey } = opts
  const { host, port, username } = parseSshConnectionConfig(connection)

  const connectConfig: ConnectConfig = {
    host,
    port,
    username,
    readyTimeout: 20_000,
    hostVerifier: (key: Buffer, verify: (valid: boolean) => void): void => {
      const keyType = parseHostKeyType(key)
      const fingerprint = fingerprintHostKey(key)
      void verifyHostKey({
        host,
        port,
        keyType,
        fingerprint,
        hostKey: new Uint8Array(key)
      })
        .then((accepted) => verify(accepted))
        .catch(() => verify(false))
    }
  }

  switch (connection.authMethod) {
    case 'password': {
      if (!connection.credentialRef) {
        throw new Error('Senha não configurada para esta conexão')
      }
      connectConfig.password = await resolveSecret(connection.credentialRef)
      // Prefer keyboard-interactive when the server only offers PAM challenge-response.
      connectConfig.tryKeyboard = true
      break
    }
    case 'key': {
      if (!connection.privateKeyPath) {
        throw new Error('Caminho da chave privada não configurado')
      }
      const keyPath = expandHome(connection.privateKeyPath)
      connectConfig.privateKey = await readFile(keyPath)
      if (connection.credentialRef) {
        connectConfig.passphrase = await resolveSecret(connection.credentialRef)
      }
      break
    }
    case 'agent': {
      const agent = await resolveLocalSshAgent()
      if (!agent) {
        throw new Error(AGENT_UNAVAILABLE_MESSAGE)
      }
      connectConfig.agent = agent
      break
    }
    case 'none':
      break
    default:
      throw new Error(`Método de autenticação não suportado: ${connection.authMethod}`)
  }

  if (connection.agentForward && !connectConfig.agent) {
    // Like `ssh -A` with no agent running: connect anyway, just without forwarding.
    const agent = await resolveLocalSshAgent()
    if (agent) connectConfig.agent = agent
  }

  return connectConfig
}
