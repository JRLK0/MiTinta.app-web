import OAuthProvider, { AuthorizationError, CimdFetchError, OAuthError, getOAuthApi, type OAuthProviderOptions, type ConsentDescription } from '@cloudflare/workers-oauth-provider'
import { z } from 'zod'
import { authUser, backend, login, logout, type Session } from './backend'
import { connection, createConnection, revokeConnection, userSession, type AuthProps } from './sessions'
import { escapeHTML as esc, json, limit, now, Problem, readBounded } from './http'
import { handleMcp } from './tools'
import { withConsistentOAuthTransactions } from './oauth-transactions'

const scopes = ['collection:read', 'decks:read', 'decks:write', 'offline_access']
const readScopes = ['collection:read', 'decks:read']
const propsSchema = z.object({ connectionId: z.string().uuid(), userId: z.string().uuid(), scopes: z.array(z.string()), backendVersion: z.string() })
const csp = (callbackOrigin?: string) => `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${callbackOrigin ? ` ${callbackOrigin}` : ''}; frame-ancestors 'none'; base-uri 'none'`
function page(body: string, headers = new Headers(), status = 200) {
  headers.set('Content-Type', 'text/html; charset=utf-8')
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Conectar IA · MiTinta</title><style>:root{font:16px/1.55 system-ui;color-scheme:light dark}body{margin:0;background:light-dark(#f7f5fb,#17141d);color:light-dark(#21182e,#eee7f8)}main{max-width:480px;margin:5vh auto;padding:28px}h1{font-size:30px;margin-bottom:6px}h2{font-size:20px}p,li{overflow-wrap:anywhere}small{color:light-dark(#655a70,#c1b4ce)}label{display:block;margin:18px 0}input:not([type=checkbox]),button,a.button{box-sizing:border-box;width:100%;padding:13px 15px;font:inherit;border-radius:10px;border:1px solid #9883ac;background:light-dark(#fff,#251e2e);color:inherit}button{cursor:pointer;background:#7543a9;color:#fff;border:0;margin:8px 0}button.secondary{background:transparent;border:1px solid #9883ac;color:inherit}code{overflow-wrap:anywhere;font-size:14px}a{color:light-dark(#65319c,#d8b2ff)}.notice{padding:12px;border:1px solid #9883ac;border-radius:10px}.check{display:flex;gap:10px;align-items:flex-start}.check input{margin-top:6px}</style></head><body><main>${body}</main></body></html>`, { status, headers })
}
function consentPage(details: ConsentDescription, handle: string, headers: Headers) {
  return page(`<a href="https://mitinta.app">MiTinta</a><h1>Conecta tu colección</h1><p><strong>${esc(details.clientName)}</strong> quiere acceder a tu cuenta de Lorcana.</p><p>El retorno de autorización es <strong>${esc(details.redirectHost)}</strong>.</p><small>${details.clientDomain ? `Aplicación publicada por ${esc(details.clientDomain)}.` : 'El nombre de la aplicación no está verificado.'}${details.redirectIsLoopback ? ' Es una aplicación local.' : ''} Continúa solo si has iniciado tú esta conexión.</small><form method="post"><input type="hidden" name="handle" value="${esc(handle)}"><h2>Permisos</h2><ul>${details.scope.includes('collection:read') ? '<li>Consultar tus cartas y cantidades. La colección no se puede modificar.</li>' : ''}${details.scope.includes('decks:read') ? '<li>Consultar tus mazos y sus cartas.</li>' : ''}</ul>${details.scope.includes('decks:write') ? '<label class="check"><input type="checkbox" name="decks_write" value="yes"><span>Permitir crear, editar y <strong>eliminar mazos</strong>.<br><small>Actívalo solo si quieres que esta IA gestione tus listas.</small></span></label>' : ''}${details.scope.includes('offline_access') ? '<p><small>La conexión podrá mantenerse durante un máximo de 30 días. Puedes revocarla en MiTinta → tu cuenta → Conexiones de IA.</small></p>' : ''}<h2>Tu cuenta de MiTinta</h2><label>Correo electrónico<input type="email" name="email" autocomplete="username" required maxlength="254"></label><label>Contraseña<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><small>La IA no recibe tu contraseña ni tu sesión de MiTinta. El acceso utiliza una sesión independiente.</small><button name="decision" value="approve">Entrar y autorizar</button><button name="decision" value="deny" class="secondary" formnovalidate>Cancelar</button></form>`, headers)
}
const protectedHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const parsed = propsSchema.safeParse(ctx.props)
    if (!parsed.success) throw new Problem(401, 'connection_invalid', 'Conexión no válida.')
    if (request.method === 'POST' && !parsed.data.scopes.includes('decks:write')) {
      const body = await request.clone().json().catch(() => null) as { method?: string; params?: { name?: string } } | null
      if (body?.method === 'tools/call' && ['create_deck', 'update_deck', 'delete_deck'].includes(body.params?.name ?? '')) {
        await connection(env, parsed.data)
        const response = json({ error: 'insufficient_scope', message: 'Autoriza de nuevo esta conexión y activa el permiso para gestionar mazos.' }, 403)
        response.headers.set('WWW-Authenticate', `Bearer error="insufficient_scope", resource_metadata="${env.BASE_URL}/.well-known/oauth-protected-resource/mcp", scope="collection:read decks:read decks:write"`)
        return response
      }
    }
    await limit(env, request, `mcp:${parsed.data.connectionId}`, 120, 60)
    return handleMcp(request, env, parsed.data)
  },
}
function options(env: Env): OAuthProviderOptions<Env> {
  return {
    apiRoute: ['/mcp'], apiHandler: protectedHandler, defaultHandler,
    authorizeEndpoint: '/authorize', tokenEndpoint: '/oauth/token', clientRegistrationEndpoint: '/oauth/register',
    scopesSupported: scopes, requiredScopes: readScopes, clientIdMetadataDocumentEnabled: true,
    resourceMetadata: { resource: env.BASE_URL + '/mcp', authorization_servers: [env.BASE_URL], resource_name: 'MiTinta Lorcana' },
    accessTokenTTL: 3600, refreshTokenTTL: 30 * 86400, clientRegistrationTTL: 30 * 86400,
    tokenExchangeCallback: async input => {
      const props = propsSchema.parse(input.props)
      try {
        await connection(env, props)
        await userSession(env, props, await backend(env))
      } catch (error) {
        if (error instanceof Problem && error.status !== 401) throw new OAuthError('temporarily_unavailable', { description: 'MiTinta no está disponible. Reintenta más tarde.' })
        throw new OAuthError('invalid_grant', { description: 'La conexión ha caducado o se ha revocado. Autoriza de nuevo.' })
      }
      await env.DB.prepare('UPDATE connections SET grant_id=? WHERE id=? AND user_id=? AND revoked_at IS NULL').bind(input.grantId, props.connectionId, props.userId).run()
      const effective = props.scopes.filter(scope => input.requestedScope.includes(scope))
      return { accessTokenProps: { ...props, scopes: effective }, accessTokenScope: effective }
    },
  }
}
const defaultHandler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url), oauth = getOAuthApi(options(env), env)
    if (url.pathname === '/authorize' && request.method === 'GET') {
      await limit(env, request, 'authorize', 30, 60)
      const original = await oauth.parseAuthRequest(request)
      if (original.scope.some(scope => !scopes.includes(scope))) throw new Problem(400, 'invalid_scope', 'La aplicación ha solicitado permisos desconocidos.')
      const details = await oauth.describeConsent(original), consent = await oauth.beginConsent(original)
      consent.headers.set('Content-Security-Policy', csp(new URL(original.redirectUri).origin))
      return consentPage(details, consent.handle, consent.headers)
    }
    if (url.pathname === '/authorize' && request.method === 'POST') {
      if (request.headers.get('origin') !== env.BASE_URL) throw new Problem(403, 'origin_invalid', 'Origen no permitido.')
      const form = await request.formData(), handle = String(form.get('handle') ?? '')
      if (form.get('decision') === 'deny') {
        const denied = await oauth.denyConsent(request, handle)
        return new Response(null, { status: 302, headers: denied.headers })
      }
      await limit(env, request, 'login', 10, 900)
      const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(256) }).parse({ email: form.get('email'), password: form.get('password') })
      const config = await backend(env)
      let session: Session | null = null
      let props: AuthProps | null = null
      try {
        session = await login(config, input.email, input.password)
        const approved = await oauth.approveConsent(request, handle)
        const details = await oauth.describeConsent(approved.request)
        const granted = approved.request.scope.filter(scope => scopes.includes(scope) && (scope !== 'decks:write' || form.get('decks_write') === 'yes'))
        props = await createConnection(env, session, details.clientName, granted, config.version)
        const { redirectTo } = await oauth.completeAuthorization({ request: approved.request, userId: session.user_id, metadata: {}, scope: granted, props })
        approved.headers.set('Location', redirectTo)
        return new Response(null, { status: 302, headers: approved.headers })
      } catch (error) {
        if (props) await revokeConnection(env, props.connectionId, props.userId)
        if (session) await logout(config, session.access_token).catch(() => {})
        throw error
      }
    }
    if (url.pathname === '/api/connections' || /^\/api\/connections\/[a-f0-9-]{36}$/.test(url.pathname)) {
      const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
      if (!token) throw new Problem(401, 'session_required', 'Inicia sesión en MiTinta para ver tus conexiones.')
      const config = await backend(env), user = await authUser(config, token)
      await limit(env, request, `connections:${user.id}`, 60, 60)
      if (url.pathname === '/api/connections' && request.method === 'GET') {
        const result = await env.DB.prepare('SELECT id,client_name,scopes,created_at,expires_at,revoked_at FROM connections WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(user.id).all<{ id: string; client_name: string; scopes: string; created_at: number; expires_at: number; revoked_at: number | null }>()
        return json({ connections: result.results.map(row => ({ ...row, scopes: JSON.parse(row.scopes) as string[] })) })
      }
      if (request.method === 'DELETE' && url.pathname !== '/api/connections') {
        if (request.headers.get('origin') !== env.WEB_ORIGIN) throw new Problem(403, 'origin_invalid', 'Origen no permitido.')
        const id = z.string().uuid().parse(url.pathname.split('/').at(-1))
        const row = await env.DB.prepare('SELECT * FROM connections WHERE id=? AND user_id=?').bind(id, user.id).first<{ id: string; grant_id: string | null }>()
        if (!row) throw new Problem(404, 'connection_not_found', 'No se encontró esa conexión.')
        // D1 is authoritative. Existing tokens stop working before KV cleanup.
        await revokeConnection(env, id, user.id)
        if (row.grant_id) await oauth.revokeGrant(row.grant_id, user.id)
        return json({ revoked: true })
      }
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      await env.DB.prepare('SELECT 1').first()
      return json({ ok: true, version: '1.0.0', mcp: env.BASE_URL + '/mcp' })
    }
    if (url.pathname === '/' && request.method === 'GET') return page(`<a href="https://mitinta.app">MiTinta</a><h1>Tu colección, con tu IA</h1><p>Consulta tus cartas, descubre qué falta y gestiona tus mazos desde un cliente MCP compatible.</p><p>Dirección del servidor:</p><p class="notice"><code>${esc(env.BASE_URL)}/mcp</code></p><p>Añade esta dirección en tu cliente de IA e inicia sesión con tu cuenta de MiTinta cuando se abra la autorización.</p><p>La colección es de solo lectura. Tú decides si permites crear, editar y eliminar mazos.</p><p>Gestiona tus conexiones desde <a href="https://mitinta.app/collection/">MiTinta → tu cuenta → Conexiones de IA</a>.</p>`)
    throw new Problem(404, 'not_found', 'Ruta no disponible.')
  },
}
function problem(error: unknown): Problem {
  if (error instanceof Problem) return error
  if (error instanceof z.ZodError) return new Problem(400, 'invalid_input', 'Revisa los campos de la solicitud.')
  if (error instanceof AuthorizationError) return new Problem(400, `oauth_${error.code}`, 'Esta autorización no es válida, ha caducado o ya se utilizó. Inicia una conexión nueva desde tu cliente de IA.')
  if (error instanceof CimdFetchError) return new Problem(400, 'client_metadata_invalid', 'No se pudieron validar los datos del cliente MCP.')
  return new Problem(503, 'service_unavailable', 'No se pudo completar la operación. Reintenta más tarde.')
}
export default {
  async fetch(request: Request, originalEnv: Env, ctx: ExecutionContext) {
    const env = withConsistentOAuthTransactions(originalEnv)
    let response: Response
    const url = new URL(request.url), origin = request.headers.get('origin')
    try {
      if (url.origin !== env.BASE_URL) throw new Problem(403, 'host_invalid', 'Servidor no permitido.')
      const management = url.pathname.startsWith('/api/connections')
      if (origin && origin !== env.BASE_URL && !(management && origin === env.WEB_ORIGIN)) throw new Problem(403, 'origin_invalid', 'Origen no permitido.')
      if (request.method === 'OPTIONS' && management && origin === env.WEB_ORIGIN) {
        response = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Max-Age': '600' } })
      } else {
        if (request.body) {
          const text = await readBounded(request, 131072)
          request = new Request(request.url, { method: request.method, headers: request.headers, body: text })
        }
        if (url.pathname === '/oauth/register') await limit(env, request, 'registration', 20, 3600)
        if (url.pathname === '/oauth/token') await limit(env, request, 'token', 90, 60)
        response = await new OAuthProvider(options(env)).fetch(request, env, ctx)
      }
      ctx.waitUntil(env.DB.batch([
        env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now()),
        env.DB.prepare('DELETE FROM oauth_transactions WHERE expires_at<?').bind(now()),
        env.DB.prepare('UPDATE connections SET encrypted_session=NULL WHERE expires_at<? AND encrypted_session IS NOT NULL').bind(now()),
        env.DB.prepare('DELETE FROM connections WHERE expires_at<?').bind(now() - 30 * 86400),
      ]))
    } catch (error) {
      const issue = problem(error)
      console.warn(JSON.stringify({ event: 'request_error', code: issue.code, status: issue.status }))
      response = url.pathname === '/authorize' ? page(`<h1>No se pudo autorizar</h1><p role="alert">${esc(issue.message)}</p><p><a href="${esc(request.url)}">Volver a intentar</a></p><p><a href="https://mitinta.app/collection/">Volver a MiTinta</a></p>`, new Headers(), issue.status) : json({ error: issue.code, message: issue.message }, issue.status)
    }
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Strict-Transport-Security', 'max-age=31536000')
    headers.set('Referrer-Policy', headers.get('Content-Type')?.startsWith('text/html') ? 'same-origin' : 'no-referrer')
    if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', csp())
    if (url.pathname.startsWith('/api/connections') && origin === env.WEB_ORIGIN) {
      headers.set('Access-Control-Allow-Origin', env.WEB_ORIGIN)
      headers.set('Vary', 'Origin')
    }
    if (response.status === 401 && url.pathname === '/mcp') headers.set('WWW-Authenticate', `Bearer resource_metadata="${env.BASE_URL}/.well-known/oauth-protected-resource/mcp", scope="${readScopes.join(' ')}"`)
    return new Response(response.body, { status: response.status, headers })
  },
} satisfies ExportedHandler<Env>
