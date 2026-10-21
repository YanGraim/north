import { readFile } from 'node:fs/promises'
import type { FastifyInstance, FastifyReply } from 'fastify'

/** The only files the panel serves; nothing else under the folder is reachable. */
const FILES: Record<string, string> = {
  'index.html': 'text/html; charset=utf-8',
  'admin.js': 'text/javascript; charset=utf-8',
  'admin.css': 'text/css; charset=utf-8'
}

// The Entra token endpoint is the one other origin the panel may call (PKCE redemption).
const csp = (identityOrigin: string | null) =>
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'${identityOrigin ? ` ${identityOrigin}` : ''}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-cache'
}

/** Admin web panel (ADR 0018 fase 3b): static page that talks to the same `/api/v1`. */
export function registerAdminPanel(
  app: FastifyInstance,
  adminDir: string,
  identityOrigin: string | null = null
): void {
  const headers = { ...SECURITY_HEADERS, 'content-security-policy': csp(identityOrigin) }
  const cache = new Map<string, Promise<Buffer>>()
  const send = async (reply: FastifyReply, name: string) => {
    let file = cache.get(name)
    if (!file) {
      file = readFile(`${adminDir}${name}`)
      cache.set(name, file)
    }
    return reply.headers({ ...headers, 'content-type': FILES[name] }).send(await file)
  }

  app.get('/admin', (_req, reply) => send(reply, 'index.html'))
  app.get('/admin/', (_req, reply) => send(reply, 'index.html'))
  app.get('/admin/:file', async (req, reply) => {
    const { file } = req.params as { file: string }
    if (!Object.hasOwn(FILES, file)) {
      return reply.status(404).send({ error: { code: 'not_found', message: 'Not found' } })
    }
    return send(reply, file)
  })
}
