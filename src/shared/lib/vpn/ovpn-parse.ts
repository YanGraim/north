import type { OpenVpnConfig, VpnRemote } from '@shared/types'
import { parseCidr } from './cidr'

/** Inline blocks holding secret material — moved to the vault, re-injected at connect time. */
export const SECRET_INLINE_BLOCKS = [
  'key',
  'tls-auth',
  'tls-crypt',
  'tls-crypt-v2',
  'pkcs12',
  'secret'
] as const

/**
 * Directives that run code, open control channels, read/write arbitrary paths,
 * or point at external files we can't import. An `.ovpn` is untrusted input:
 * it will be executed by a root process.
 */
const BLOCKED_DIRECTIVES = new Set([
  'up',
  'down',
  'route-up',
  'route-pre-down',
  'ipchange',
  'client-connect',
  'client-disconnect',
  'learn-address',
  'auth-user-pass-verify',
  'tls-verify',
  'plugin',
  'management',
  'management-client',
  'management-hold',
  'management-query-passwords',
  'config',
  'cd',
  'chroot',
  'daemon',
  'writepid',
  'log',
  'log-append',
  'status',
  'askpass',
  'iproute',
  'tmp-dir',
  'setenv-safe',
  'user',
  'group'
])

/** Directives that only make sense pointing at a file — unsupported unless inline. */
const FILE_DIRECTIVES = new Set([
  'ca',
  'cert',
  'key',
  'tls-auth',
  'tls-crypt',
  'tls-crypt-v2',
  'pkcs12',
  'secret',
  'extra-certs',
  'crl-verify',
  'dh'
])

export class OvpnParseError extends Error {
  constructor(
    message: string,
    readonly directive: string,
    readonly line?: number
  ) {
    super(message)
    this.name = 'OvpnParseError'
  }
}

export type ParsedOvpn = {
  config: OpenVpnConfig
  /** Secret inline blocks by tag name (e.g. `key`, `tls-crypt`). Main stores these in the vault. */
  inlineBlocks: Record<string, string>
  suggestedName: string
}

export function parseOvpn(text: string): ParsedOvpn {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  const inlineBlocks: Record<string, string> = {}
  const remotes: Array<{ host: string; port?: number; proto?: string }> = []
  const routes: string[] = []
  let defaultPort = 1194
  let defaultProto = 'udp'
  let requiresUserPass = false
  let redirectGateway = false
  let keyBlock = ''

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    const open = /^<([a-z0-9-]+)>$/i.exec(trimmed)
    if (open) {
      const tag = open[1].toLowerCase()
      const end = lines.findIndex((l, j) => j > i && l.trim().toLowerCase() === `</${tag}>`)
      if (end === -1) throw new OvpnParseError(`Bloco <${tag}> sem fechamento`, tag, i + 1)
      const body = lines.slice(i + 1, end).join('\n')
      if ((SECRET_INLINE_BLOCKS as readonly string[]).includes(tag)) {
        inlineBlocks[tag] = body
        if (tag === 'key') keyBlock = body
      } else if (tag === 'connection') {
        throw new OvpnParseError('Blocos <connection> ainda não são suportados', tag, i + 1)
      } else {
        kept.push(...lines.slice(i, end + 1))
      }
      i = end
      continue
    }

    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      kept.push(raw)
      continue
    }

    const [directiveRaw, ...args] = trimmed.split(/\s+/)
    const directive = directiveRaw.replace(/^--/, '').toLowerCase()

    if (BLOCKED_DIRECTIVES.has(directive)) {
      throw new OvpnParseError(
        `A diretiva "${directive}" não é permitida em arquivos importados (executa código ou acessa arquivos do sistema)`,
        directive,
        i + 1
      )
    }
    if (directive === 'script-security' && Number(args[0] ?? 0) > 1) {
      throw new OvpnParseError(
        '"script-security" acima de 1 permite executar scripts e não é permitido',
        directive,
        i + 1
      )
    }
    if (
      FILE_DIRECTIVES.has(directive) &&
      args.length > 0 &&
      !(directive === 'tls-auth' && /^[01]$/.test(args[0]))
    ) {
      throw new OvpnParseError(
        `"${directive}" aponta para um arquivo externo. Exporte o .ovpn com os certificados e chaves embutidos (blocos <${directive}>)`,
        directive,
        i + 1
      )
    }

    switch (directive) {
      case 'remote':
        if (!args[0]) throw new OvpnParseError('"remote" sem host', directive, i + 1)
        remotes.push({
          host: args[0],
          port: args[1] ? Number(args[1]) : undefined,
          proto: args[2]
        })
        break
      case 'port':
        if (args[0]) defaultPort = Number(args[0])
        break
      case 'proto':
        if (args[0]) defaultProto = args[0]
        break
      case 'auth-user-pass':
        requiresUserPass = true
        // a file argument would hold plaintext creds — credentials go through management
        kept.push('auth-user-pass')
        continue
      case 'redirect-gateway':
        redirectGateway = true
        break
      case 'route': {
        const cidr = args[0] && parseCidr(args[1] ? `${args[0]} ${args[1]}` : args[0])
        if (cidr) routes.push(`${args[0]}/${cidr.prefix}`)
        break
      }
    }
    kept.push(raw)
  }

  if (remotes.length === 0) {
    throw new OvpnParseError('O arquivo não declara nenhum servidor ("remote")', 'remote')
  }

  const remoteSummary: VpnRemote[] = remotes.map((r) => {
    const port =
      r.port && Number.isInteger(r.port) && r.port > 0 && r.port <= 65535 ? r.port : defaultPort
    return { host: r.host, port, proto: normalizeProto(r.proto ?? defaultProto) }
  })

  return {
    config: {
      kind: 'openvpn',
      ovpn: kept.join('\n').replace(/\n{3,}/g, '\n\n'),
      requiresUserPass,
      requiresKeyPassphrase: /ENCRYPTED/.test(keyBlock),
      remoteSummary,
      redirectGateway,
      declaredRoutes: routes
    },
    inlineBlocks,
    suggestedName: remoteSummary[0].host
  }
}

function normalizeProto(proto: string): 'udp' | 'tcp' {
  return proto.toLowerCase().startsWith('tcp') ? 'tcp' : 'udp'
}
