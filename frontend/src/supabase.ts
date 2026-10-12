import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readAuthCallback } from './authCallback'
import { readBackendConfig, sameBackend, type BackendConfig } from './backendConfig'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const isConfigured = Boolean(url && publishableKey)
// Capture before createClient: URL detection may finish before React subscribes.
export const initialAuthCallback = readAuthCallback(typeof window === 'undefined' ? '' : window.location.hash)
export let supabase: SupabaseClient
if (!import.meta.env.VITE_BACKEND_CONFIG_URL) {
  supabase = createClient(url || 'https://example.supabase.co', publishableKey || 'not-configured')
}

export async function initializeBackend() {
  const endpoint = import.meta.env.VITE_BACKEND_CONFIG_URL
  if (!endpoint) return // Preserve the legacy GitHub Pages build during transition.
  const config = await readBackendConfig(endpoint)
  if (config.maintenance) throw new Error('MiTinta está en mantenimiento. Tus datos se conservan; vuelve a intentarlo más tarde.')
  supabase = createClient(config.url, config.publishableKey, {
    auth: { storageKey: `mitinta-auth:${config.version}` },
    global: { fetch: async (input, init) => {
      const current: BackendConfig = await readBackendConfig(endpoint)
      if (current.maintenance) throw new Error('MiTinta está en mantenimiento. Vuelve a intentarlo más tarde.')
      if (!sameBackend(config, current)) {
        window.location.reload()
        throw new Error('La conexión ha cambiado. Vuelve a iniciar sesión.')
      }
      return fetch(input, init)
    } },
  })
}
