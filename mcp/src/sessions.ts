import { authUser, refresh, type Backend, type Session } from './backend'
import { now, Problem, random } from './http'

export type Connection = {
  id: string; user_id: string; client_name: string; scopes: string;
  encrypted_session: string | null; grant_id: string | null;
  created_at: number; expires_at: number; revoked_at: number | null;
}
export type AuthProps = { connectionId: string; userId: string; scopes: string[]; backendVersion: string }
async function key(env: Env) {
  const bytes = Uint8Array.from(atob(env.SESSION_KEY), value => value.charCodeAt(0))
  if (bytes.length !== 32) throw new Error('Invalid session encryption key')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function encrypt(env: Env, id: string, session: Session) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, await key(env), new TextEncoder().encode(JSON.stringify(session)))
  return btoa(String.fromCharCode(...iv)) + '.' + btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
}
async function decrypt(env: Env, id: string, envelope: string): Promise<Session> {
  const [iv, ciphertext] = envelope.split('.').map(value => Uint8Array.from(atob(value), char => char.charCodeAt(0)))
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, await key(env), ciphertext)
  return JSON.parse(new TextDecoder().decode(data)) as Session
}
export async function createConnection(env: Env, session: Session, clientName: string, scopes: string[], backendVersion: string): Promise<AuthProps> {
  const id = random()
  await env.DB.prepare('INSERT INTO connections(id,user_id,client_name,scopes,encrypted_session,created_at,expires_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, session.user_id, clientName.slice(0, 200), JSON.stringify(scopes), await encrypt(env, id, session), now(), now() + 30 * 86400).run()
  return { connectionId: id, userId: session.user_id, scopes, backendVersion }
}
export async function connection(env: Env, props: AuthProps): Promise<Connection> {
  if (!props?.connectionId || !props.userId) throw new Problem(401, 'connection_invalid', 'Conexión no válida.')
  const row = await env.DB.prepare('SELECT * FROM connections WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?')
    .bind(props.connectionId, props.userId, now()).first<Connection>()
  if (!row?.encrypted_session) throw new Problem(401, 'connection_revoked', 'Esta conexión ha caducado o se ha revocado. Vuelve a conectar tu cuenta.')
  return row
}
export async function revokeConnection(env: Env, id: string, userId: string) {
  return env.DB.prepare('UPDATE connections SET revoked_at=?,encrypted_session=NULL,refresh_owner=NULL,refresh_until=0 WHERE id=? AND user_id=? AND revoked_at IS NULL RETURNING grant_id')
    .bind(now(), id, userId).first<{ grant_id: string | null }>()
}
export async function userSession(env: Env, props: AuthProps, config: Backend): Promise<Session> {
  if (props.backendVersion !== config.version) throw new Problem(401, 'backend_changed', 'La conexión de MiTinta ha cambiado. Autoriza de nuevo a la IA.')
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = await connection(env, props)
    const session = await decrypt(env, row.id, row.encrypted_session!)
    if (session.user_id !== row.user_id) throw new Problem(401, 'session_invalid', 'Sesión no válida.')
    if (session.expires_at > now() + 60) {
      const user = await authUser(config, session.access_token)
      if (user.id !== row.user_id) throw new Problem(401, 'session_invalid', 'Sesión no válida.')
      return session
    }
    const lease = random()
    const locked = await env.DB.prepare('UPDATE connections SET refresh_owner=?,refresh_until=? WHERE id=? AND revoked_at IS NULL AND expires_at>? AND refresh_until<=? RETURNING encrypted_session')
      .bind(lease, now() + 30, row.id, now(), now()).first<{ encrypted_session: string }>()
    if (!locked) { await new Promise(resolve => setTimeout(resolve, 150)); continue }
    try {
      // Read after acquiring the lease: another request may already have rotated.
      const latest = await decrypt(env, row.id, locked.encrypted_session)
      const renewed = latest.expires_at > now() + 60 ? latest : await refresh(config, latest.refresh_token)
      if (renewed.user_id !== row.user_id) throw new Problem(401, 'session_invalid', 'Sesión no válida.')
      const saved = await env.DB.prepare('UPDATE connections SET encrypted_session=?,refresh_owner=NULL,refresh_until=0 WHERE id=? AND refresh_owner=? AND revoked_at IS NULL RETURNING id')
        .bind(await encrypt(env, row.id, renewed), row.id, lease).first()
      if (!saved) throw new Problem(401, 'connection_revoked', 'La conexión se ha revocado.')
      return renewed
    } catch (error) {
      if (error instanceof Problem && error.status === 401) await revokeConnection(env, row.id, row.user_id)
      throw error
    } finally {
      await env.DB.prepare('UPDATE connections SET refresh_owner=NULL,refresh_until=0 WHERE id=? AND refresh_owner=?').bind(row.id, lease).run()
    }
  }
  throw new Problem(503, 'session_busy', 'Se está renovando la conexión. Reintenta dentro de unos segundos.')
}
