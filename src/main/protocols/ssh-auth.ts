import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import type { ConnectOptions } from '@shared/protocols'
import type { ConnectConfig } from 'ssh2'
import { fingerprintHostKey, parseHostKeyType, parseSshConnectionConfig } from './ssh-utils'

function expandHome(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2))
  }
  return filePath
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
      const agent = process.env.SSH_AUTH_SOCK
      if (!agent) {
        throw new Error('SSH agent indisponível (SSH_AUTH_SOCK não definido)')
      }
      connectConfig.agent = agent
      break
    }
    case 'none':
      break
    default:
      throw new Error(`Método de autenticação não suportado: ${connection.authMethod}`)
  }

  return connectConfig
}
