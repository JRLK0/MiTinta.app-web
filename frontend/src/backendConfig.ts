export type BackendConfig = { url: string; publishableKey: string; version: string; maintenance: boolean }

export function validateBackendConfig(value: unknown): BackendConfig {
  if (!value || typeof value !== 'object') throw new Error('Configuración de conexión inválida')
  const config = value as BackendConfig
  const url = new URL(config.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      !['wedzkhkkqilokvfmzyuv.supabase.co', 'api.mitinta.app'].includes(url.hostname) || url.port) {
    throw new Error('Servidor de conexión no autorizado')
  }
  if (typeof config.publishableKey !== 'string' || !config.publishableKey ||
      typeof config.version !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(config.version) ||
      typeof config.maintenance !== 'boolean') throw new Error('Configuración de conexión inválida')
  if (config.publishableKey.startsWith('sb_secret_')) throw new Error('La clave debe ser publicable')
  if (config.publishableKey.split('.').length === 3) {
    const payload = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role !== 'anon') throw new Error('La clave debe ser anónima')
  } else if (!config.publishableKey.startsWith('sb_publishable_')) {
    throw new Error('La clave debe ser publicable')
  }
  return { ...config, url: url.origin }
}

export function sameBackend(a: BackendConfig, b: BackendConfig) {
  return a.url === b.url && a.publishableKey === b.publishableKey && a.version === b.version
}

export function prepareBackendSession(config: BackendConfig, storage: Storage) {
  const identity = JSON.stringify({ url: config.url, publishableKey: config.publishableKey, version: config.version })
  const previous = storage.getItem('mitinta-backend-identity')
  if (previous && previous !== identity) {
    try {
      const old = JSON.parse(previous)
      if (typeof old.version === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(old.version)) {
        storage.removeItem(`mitinta-auth:${old.version}`)
      }
    } catch { /* A damaged identity cannot authorize reusing a session. */ }
    storage.removeItem(`mitinta-auth:${config.version}`)
  }
  storage.setItem('mitinta-backend-identity', identity)
}

export async function readBackendConfig(endpoint: string): Promise<BackendConfig> {
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('No se pudo verificar la conexión. Inténtalo de nuevo.')
  return validateBackendConfig(await response.json())
}
