type Env = { ASSETS: { fetch(request: Request): Promise<Response> } }

// React/Motion and the privacy page use inline styles; scripts stay same-origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cards.lorcast.io https://cards.duels.ink",
  "font-src 'self'",
  "connect-src 'self' https://api.lorcast.com https://wedzkhkkqilokvfmzyuv.supabase.co wss://wedzkhkkqilokvfmzyuv.supabase.co https://api.mitinta.app wss://api.mitinta.app",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === 'www.mitinta.app' || url.protocol === 'http:') {
      if (url.hostname === 'www.mitinta.app') url.hostname = 'mitinta.app'
      url.protocol = 'https:'
      return new Response(null, { status: 308, headers: {
        Location: url.toString(),
        'Strict-Transport-Security': 'max-age=31536000',
      } })
    }
    // Never let an unknown route fall back to HTML (especially backend.json).
    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('Strict-Transport-Security', 'max-age=31536000')
    if (url.pathname === '/backend.json') {
      headers.set('Cache-Control', 'no-store')
      headers.set('Access-Control-Allow-Origin', '*')
    } else if (response.headers.get('Content-Type')?.includes('text/html')) {
      headers.set('Cache-Control', 'no-cache')
      headers.set('Content-Security-Policy', contentSecurityPolicy)
    }
    return new Response(response.body, { status: response.status, headers })
  },
}
