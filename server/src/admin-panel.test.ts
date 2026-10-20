import type { FastifyInstance } from 'fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './test-utils'

let app: FastifyInstance

beforeAll(async () => {
  ;({ app } = await createTestApp())
})

describe('admin web panel', () => {
  it('serves the page without a token', async () => {
    for (const url of ['/admin', '/admin/']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toMatch(/^text\/html/)
      expect(res.body).toContain('<script type="module" src="/admin/admin.js"></script>')
    }
  })

  it('locks the page down: own scripts only, no framing, no sniffing', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin' })
    const csp = String(res.headers['content-security-policy'])
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })

  it('serves its script and stylesheet with the right types', async () => {
    const js = await app.inject({ method: 'GET', url: '/admin/admin.js' })
    expect(js.statusCode).toBe(200)
    expect(js.headers['content-type']).toMatch(/^text\/javascript/)
    const css = await app.inject({ method: 'GET', url: '/admin/admin.css' })
    expect(css.statusCode).toBe(200)
    expect(css.headers['content-type']).toMatch(/^text\/css/)
  })

  it('serves nothing else from disk', async () => {
    for (const url of [
      '/admin/../package.json',
      '/admin/%2e%2e/package.json',
      '/admin/index.ts',
      '/admin/missing.js'
    ]) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404)
    }
  })
})
