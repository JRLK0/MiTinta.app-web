import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ create: vi.fn(), request: null as null | typeof fetch }))
vi.mock('@supabase/supabase-js', () => ({ createClient: client.create }))
const config = { url: 'https://wedzkhkkqilokvfmzyuv.supabase.co', publishableKey: 'sb_publishable_test', version: 'managed-1', maintenance: false }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_BACKEND_CONFIG_URL', '/backend.json')
  const values = new Map<string, string>()
  vi.stubGlobal('window', { location: { hash: '', reload: vi.fn() }, localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  client.create.mockImplementation((_url, _key, options) => {
    client.request = options.global.fetch
    return { auth: { stopAutoRefresh: vi.fn() }, removeAllChannels: vi.fn() }
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

it.each(['HTTP failure', 'invalid config', 'timeout'])('exposes %s as unavailable and recovers on retry', async (reason) => {
  const fetchMock = vi.fn().mockImplementation(async () => {
    if (reason === 'timeout') throw new DOMException('Timed out', 'TimeoutError')
    return reason === 'HTTP failure' ? new Response('', { status: 503 }) : Response.json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  const backend = await import('./supabase')
  await backend.initializeBackend()
  expect(backend.getBackendState().status).toBe('error')
  expect(client.create).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(Response.json(config))
  await backend.initializeBackend()
  expect(backend.getBackendState().status).toBe('ready')
})

it('groups concurrent verification but rechecks subsequent private requests', async () => {
  const fetchMock = vi.fn().mockImplementation(async (url) => url === '/backend.json' ? Response.json(config) : new Response('private'))
  vi.stubGlobal('fetch', fetchMock)
  const backend = await import('./supabase')
  await backend.initializeBackend()
  fetchMock.mockClear()
  await Promise.all([client.request!('/private/one'), client.request!('/private/two')])
  expect(fetchMock.mock.calls.filter(([url]) => url === '/backend.json')).toHaveLength(1)
  await client.request!('/private/three')
  expect(fetchMock.mock.calls.filter(([url]) => url === '/backend.json')).toHaveLength(2)
})

it('blocks private fetches during maintenance and backend change', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(config))
  vi.stubGlobal('fetch', fetchMock)
  const backend = await import('./supabase')
  await backend.initializeBackend()
  fetchMock.mockResolvedValue(Response.json({ ...config, maintenance: true }))
  await expect(client.request!('/private')).rejects.toThrow('mantenimiento')
  expect(backend.getBackendState().status).toBe('maintenance')
  expect(fetchMock.mock.calls.some(([url]) => url === '/private')).toBe(false)
  fetchMock.mockResolvedValue(Response.json(config))
  await backend.initializeBackend()
  fetchMock.mockResolvedValue(Response.json({ ...config, version: 'changed' }))
  await expect(client.request!('/private')).rejects.toThrow('cambiado')
  expect(window.location.reload).toHaveBeenCalledOnce()
})
