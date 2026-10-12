import { describe, expect, it, vi, afterEach } from 'vitest'
import { readBackendConfig, sameBackend, validateBackendConfig } from './backendConfig'

const config = { url: 'https://api.mitinta.app', publishableKey: 'sb_publishable_test', version: 'ct-1', maintenance: false }
afterEach(() => vi.unstubAllGlobals())
describe('migration connection configuration', () => {
  it('accepts only our HTTPS backends', () => {
    expect(validateBackendConfig(config)).toEqual(config)
    for (const url of ['http://api.mitinta.app', 'https://api.mitinta.app.attacker.test', 'https://user@api.mitinta.app', 'https://api.mitinta.app/path', 'https://api.mitinta.app:8443']) {
      expect(() => validateBackendConfig({ ...config, url })).toThrow()
    }
  })
  it('rejects secret and service role keys', () => {
    expect(() => validateBackendConfig({ ...config, publishableKey: 'sb_secret_test' })).toThrow()
    const serviceKey = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`
    expect(() => validateBackendConfig({ ...config, publishableKey: serviceKey })).toThrow()
  })
  it('requires version and an explicit maintenance flag', () => {
    expect(() => validateBackendConfig({ ...config, maintenance: undefined })).toThrow()
    expect(() => validateBackendConfig({ ...config, version: '' })).toThrow()
    expect(sameBackend(config, { ...config, version: 'ct-2' })).toBe(false)
    expect(sameBackend(config, { ...config, publishableKey: 'sb_publishable_other' })).toBe(false)
  })
  it('never accepts an HTTP failure as cached configuration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('maintenance', { status: 503 })))
    await expect(readBackendConfig('/backend.json')).rejects.toThrow()
  })
})
