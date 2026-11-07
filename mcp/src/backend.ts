import { Problem, readBounded, remote } from './http'
import type { CatalogCard } from '../../frontend/src/catalog'
import { validateBackendConfig } from '../../frontend/src/backendConfig'

export type Backend = { url: string; publishableKey: string; version: string; maintenance: boolean }
export type Session = { access_token: string; refresh_token: string; expires_at: number; user_id: string }
export type User = { id: string }

export async function backend(env: Env): Promise<Backend> {
  const response = await remote(`${env.WEB_ORIGIN}/backend.json`, { headers: { 'Cache-Control': 'no-cache' } })
  if (!response.ok) throw new Problem(503, 'backend_unavailable', 'No se pudo verificar la conexión de MiTinta.')
  let config: Backend
  try { config = validateBackendConfig(JSON.parse(await readBounded(response, 8192))) }
  catch { throw new Problem(503, 'backend_invalid', 'La configuración de MiTinta no es válida.') }
  if (config.maintenance) throw new Problem(503, 'maintenance', 'MiTinta está en mantenimiento. Reintenta más tarde.')
  return config
}
export async function authUser(config: Backend, token: string): Promise<User> {
  const response = await remote(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` } })
  if (response.status === 401 || response.status === 403) throw new Problem(401, 'session_expired', 'La sesión ha caducado. Vuelve a conectar tu cuenta.')
  if (!response.ok) throw new Problem(503, 'backend_unavailable', 'No se pudo comprobar tu cuenta de MiTinta.')
  const user = JSON.parse(await readBounded(response, 32768)) as User
  if (!user.id) throw new Problem(401, 'session_invalid', 'Sesión no válida.')
  return user
}
async function tokenRequest(config: Backend, grant: 'password' | 'refresh_token', data: Record<string, string>): Promise<Session> {
  const response = await remote(`${config.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if ([400, 401, 403, 422].includes(response.status)) {
    throw new Problem(401, grant === 'password' ? 'login_failed' : 'session_expired', grant === 'password' ? 'No se pudo iniciar sesión. Comprueba tu correo, contraseña y que hayas confirmado la cuenta.' : 'La sesión ha caducado. Vuelve a conectar tu cuenta.')
  }
  if (response.status === 429) throw new Problem(429, 'rate_limited', 'Demasiados intentos. Espera unos minutos.')
  if (!response.ok) throw new Problem(503, 'backend_unavailable', 'No se pudo iniciar sesión en MiTinta.')
  const dataOut = JSON.parse(await readBounded(response, 65536)) as { access_token: string; refresh_token: string; expires_at?: number; expires_in: number; user: User }
  if (!dataOut.access_token || !dataOut.refresh_token || !dataOut.user?.id) throw new Problem(503, 'backend_invalid', 'Respuesta de acceso no válida.')
  return { access_token: dataOut.access_token, refresh_token: dataOut.refresh_token, expires_at: dataOut.expires_at ?? Math.floor(Date.now() / 1000) + dataOut.expires_in, user_id: dataOut.user.id }
}
export const login = (config: Backend, email: string, password: string) => tokenRequest(config, 'password', { email, password })
export const refresh = (config: Backend, token: string) => tokenRequest(config, 'refresh_token', { refresh_token: token })
export async function logout(config: Backend, token: string) {
  await remote(`${config.url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` } })
}
export async function rest<T>(config: Backend, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await remote(`${config.url}/rest/v1/${path}`, {
    ...init, headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  const text = await readBounded(response, 4 * 1024 * 1024)
  if (!response.ok) {
    let code = ''
    try { code = JSON.parse(text).code ?? '' } catch { /* Never forward raw backend errors. */ }
    if (code === '40001' || code === 'PT409') throw new Problem(409, 'deck_conflict', 'El mazo cambió. Vuelve a leerlo antes de modificarlo; conserva tus cambios locales.')
    if (code === 'P0002') throw new Problem(404, 'deck_not_found', 'No se encontró un mazo propio con ese identificador.')
    if (response.status === 401) throw new Problem(401, 'session_expired', 'La sesión ha caducado. Vuelve a conectar tu cuenta.')
    if (code === '23514') throw new Problem(400, 'deck_limit', 'El mazo supera un límite de MiTinta: 100 mazos por cuenta, 200 cartas distintas por mazo y cantidades entre 1 y 99.')
    if (code === '54000') throw new Problem(429, 'operation_storage_limit', 'Se ha alcanzado el límite de 1000 operaciones de mazos en treinta días. No se han aplicado cambios.')
    if (['22023', '23502', '23505', '22P02'].includes(code)) throw new Problem(400, 'invalid_deck', 'Datos de mazo no válidos, cartas repetidas o identificador de operación ya usado con otro contenido.')
    if (response.status === 403) throw new Problem(403, 'forbidden', 'Esta operación no está permitida para tu cuenta.')
    throw new Problem(503, 'backend_error', 'MiTinta no pudo completar la operación. Puedes reintentar con el mismo request_id.')
  }
  return (text ? JSON.parse(text) : null) as T
}
export async function allRows<T>(config: Backend, token: string, path: string) {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const page = await rest<T[]>(config, token, `${path}&offset=${offset}&limit=500`)
    rows.push(...page)
    if (page.length < 500) return rows
    if (rows.length >= 100000) throw new Problem(413, 'collection_too_large', 'La colección supera el límite de esta consulta. Usa filtros para consultarla.')
  }
}
export type Catalog = { updated_at: string; cards: CatalogCard[] }
export async function catalog(env: Env): Promise<Catalog> {
  const url = `${env.WEB_ORIGIN}/collection/catalog.json`
  const cache = await caches.open('mitinta-lorcana-catalog')
  const cached = await cache.match(url)
  const response = cached ?? await remote(url, { headers: { 'Cache-Control': 'no-cache' } })
  if (!response.ok) throw new Problem(503, 'catalog_unavailable', 'No se pudo cargar el catálogo de MiTinta.')
  const text = await readBounded(response, 8 * 1024 * 1024)
  const value = JSON.parse(text) as Catalog
  if (!value.updated_at || !Array.isArray(value.cards) || value.cards.length === 0) throw new Problem(503, 'catalog_invalid', 'El catálogo de MiTinta no está disponible.')
  if (!cached) await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' } }))
  return value
}
