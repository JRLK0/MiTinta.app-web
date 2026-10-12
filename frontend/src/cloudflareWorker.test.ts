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
    expect(result.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
  })
  it('protects HTML without blocking the catalog, backend or realtime', async () => {
    const result = await worker.fetch(new Request('https://mitinta.app/collection/'), assets)
    const policy = result.headers.get('Content-Security-Policy')!
    const directives = new Map(policy.split('; ').map(directive => {
      const [name, ...sources] = directive.split(' ')
      return [name, sources]
    }))
    expect(directives.get('script-src')).toEqual(["'self'"])
    expect(directives.get('object-src')).toEqual(["'none'"])
    expect(directives.get('base-uri')).toEqual(["'none'"])
    expect(directives.get('frame-ancestors')).toEqual(["'none'"])
    expect(directives.get('connect-src')).toEqual(expect.arrayContaining([
      'https://api.lorcast.com', 'https://api.mitinta.app', 'wss://api.mitinta.app',
      'https://wedzkhkkqilokvfmzyuv.supabase.co', 'wss://wedzkhkkqilokvfmzyuv.supabase.co',
    ]))
    expect(directives.get('img-src')).toEqual(expect.arrayContaining(['https://cards.lorcast.io', 'https://cards.duels.ink']))
    expect(result.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    expect(result.headers.get('Cache-Control')).toBe('no-cache')
    expect(await result.text()).toBe('asset')
  })
  it('retains asset status and headers and adds HSTS to non-HTML responses', async () => {
    const asset = { ASSETS: { fetch: async () => new Response('css', {
      status: 206, headers: { 'Content-Type': 'text/css', 'ETag': 'asset-version' },
    }) } }
    const result = await worker.fetch(new Request('https://mitinta.app/theme.css'), asset)
    expect(result.status).toBe(206)
    expect(result.headers.get('ETag')).toBe('asset-version')
    expect(result.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    expect(result.headers.has('Content-Security-Policy')).toBe(false)
    expect(await result.text()).toBe('css')
  })
  it('never caches the backend configuration or masks missing routes', async () => {
    const missing = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }
    const config = await worker.fetch(new Request('https://mitinta.app/backend.json'), assets)
    expect(config.headers.get('Cache-Control')).toBe('no-store')
    expect(config.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect((await worker.fetch(new Request('https://mitinta.app/.env'), missing)).status).toBe(404)
  })
})
