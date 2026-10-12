import { describe, expect, it, vi, afterEach } from 'vitest'
import { readBackendConfig, sameBackend, validateBackendConfig, prepareBackendSession } from './backendConfig'

const config = { url: 'https://api.mitinta.app', publishableKey: 'sb_publishable_test', version: 'ct-1', maintenance: false }
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, key: i => [...values.keys()][i] ?? null,
    clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } }
}
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
  it('invalidates auth when URL or key changes even if version is unchanged', () => {
    const storage = memoryStorage()
    prepareBackendSession(config, storage)
    storage.setItem('mitinta-auth:ct-1', 'old-session')
    storage.setItem('private-draft:user', 'pending-cards')
    prepareBackendSession({ ...config, publishableKey: 'sb_publishable_changed' }, storage)
    expect(storage.getItem('mitinta-auth:ct-1')).toBeNull()
    expect(storage.getItem('private-draft:user')).toBe('pending-cards')
  })
  it('preserves sessions on unchanged backend and clears old generation on cutover', () => {
    const storage = memoryStorage()
    prepareBackendSession(config, storage)
    storage.setItem('mitinta-auth:ct-1', 'current-session')
    prepareBackendSession(config, storage)
    expect(storage.getItem('mitinta-auth:ct-1')).toBe('current-session')
    prepareBackendSession({ ...config, version: 'ct-2' }, storage)
    expect(storage.getItem('mitinta-auth:ct-1')).toBeNull()
  })
})
