import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readAuthCallback } from './authCallback'
import { readBackendConfig, sameBackend, prepareBackendSession, type BackendConfig } from './backendConfig'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const isConfigured = Boolean(url && publishableKey)
// Capture before createClient: URL detection may finish before React subscribes.
export const initialAuthCallback = readAuthCallback(typeof window === 'undefined' ? '' : window.location.hash)
export let supabase: SupabaseClient
if (!import.meta.env.VITE_BACKEND_CONFIG_URL) {
  supabase = createClient(url || 'https://example.supabase.co', publishableKey || 'not-configured')
}

export type BackendState = { status: 'checking' | 'ready' | 'maintenance' | 'error'; message?: string }
let backendState: BackendState = { status: import.meta.env.VITE_BACKEND_CONFIG_URL ? 'checking' : 'ready' }
const listeners = new Set<() => void>()
export const getBackendState = () => backendState
export function subscribeBackend(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
function updateBackend(state: BackendState) { backendState = state; listeners.forEach((listener) => listener()) }
let initialization: Promise<void> | null = null
let verification: Promise<BackendConfig> | null = null

function verifyBackend(endpoint: string) {
  // Share only in-flight verification. The next request always revalidates.
  verification ??= readBackendConfig(endpoint).finally(() => { verification = null })
  return verification
}

export function initializeBackend(): Promise<void> {
  const endpoint = import.meta.env.VITE_BACKEND_CONFIG_URL
  if (!endpoint) return Promise.resolve()
  if (initialization) return initialization
  updateBackend({ status: 'checking' })
  initialization = (async () => {
    try {
      const config = await verifyBackend(endpoint)
      if (config.maintenance) {
        updateBackend({ status: 'maintenance', message: 'MiTinta está en mantenimiento. Puedes seguir consultando el catálogo.' })
        return
      }
      prepareBackendSession(config, window.localStorage)
      const client = createClient(config.url, config.publishableKey, {
        auth: { storageKey: `mitinta-auth:${config.version}` },
        global: { fetch: async (input, init) => {
          try {
            const current = await verifyBackend(endpoint)
            if (current.maintenance) {
              updateBackend({ status: 'maintenance', message: 'MiTinta está en mantenimiento. Puedes seguir consultando el catálogo.' })
              throw new Error('MiTinta está en mantenimiento. Vuelve a intentarlo más tarde.')
            }
            if (!sameBackend(config, current)) {
              prepareBackendSession(current, window.localStorage)
              updateBackend({ status: 'error', message: 'La conexión ha cambiado. Vuelve a iniciar sesión.' })
              window.location.reload()
              throw new Error('La conexión ha cambiado. Vuelve a iniciar sesión.')
            }
          } catch (error) {
            if (backendState.status === 'ready') updateBackend({ status: 'error', message: 'No se pudo verificar la conexión. El catálogo sigue disponible.' })
            throw error
          }
          return fetch(input, init)
        } },
      })
      // Discard the previous in-memory client on explicit retry.
      if (supabase) { supabase.auth.stopAutoRefresh(); await supabase.removeAllChannels() }
      supabase = client
      updateBackend({ status: 'ready' })
    } catch {
      updateBackend({ status: 'error', message: 'No se pudo verificar la conexión. El catálogo sigue disponible.' })
    }
  })().finally(() => { initialization = null })
  return initialization
}
