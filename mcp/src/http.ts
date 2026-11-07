export class Problem extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
export const now = () => Math.floor(Date.now() / 1000)
export const random = () => crypto.randomUUID()
export const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
export const json = (value: unknown, status = 200) => Response.json(value, { status })
export async function readBounded(response: Response | Request, limit: number) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) throw new Problem(413, 'body_too_large', 'La solicitud o respuesta supera el tamaño permitido.')
      chunks.push(value)
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  const data = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(data)
}
export async function remote(url: string, init: RequestInit = {}) {
  const attempts = !init.method || init.method === 'GET' ? 2 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(15000) })
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('Unexpected upstream redirect') }
      return response
    } catch {
      if (attempt + 1 < attempts) { await new Promise(resolve => setTimeout(resolve, 100)); continue }
    }
  }
  throw new Problem(503, 'backend_unavailable', 'No se pudo contactar con MiTinta. Reintenta más tarde.')
}
export async function limit(env: Env, request: Request, bucket: string, maximum: number, seconds: number) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bucket}:${ip}:${Math.floor(now() / seconds)}`))
  const key = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
  const row = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now() + seconds).first<{ count: number }>()
  if (!row || row.count > maximum) throw new Problem(429, 'rate_limited', 'Demasiadas solicitudes. Espera unos minutos.')
}
