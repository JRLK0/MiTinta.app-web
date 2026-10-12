import { describe, expect, it } from 'vitest'
import worker from '../../cloudflare/worker'

describe('Cloudflare routes', () => {
  const assets = { ASSETS: { fetch: async () => new Response('asset', { headers: { 'Content-Type': 'text/html' } }) } }
  it('upgrades HTTP without losing route or query', async () => {
    const result = await worker.fetch(new Request('http://mitinta.app/collection/?deck=abc'), assets)
    expect(result.status).toBe(308)
    expect(result.headers.get('Location')).toBe('https://mitinta.app/collection/?deck=abc')
  })
  it('canonicalizes www in one redirect', async () => {
    const result = await worker.fetch(new Request('http://www.mitinta.app/privacy/'), assets)
    expect(result.headers.get('Location')).toBe('https://mitinta.app/privacy/')
  })
  it('never caches the backend configuration or masks missing routes', async () => {
    const missing = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }
    const config = await worker.fetch(new Request('https://mitinta.app/backend.json'), assets)
    expect(config.headers.get('Cache-Control')).toBe('no-store')
    expect(config.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect((await worker.fetch(new Request('https://mitinta.app/.env'), missing)).status).toBe(404)
  })
})
