type Env = { ASSETS: { fetch(request: Request): Promise<Response> } }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === 'www.mitinta.app') {
      url.hostname = 'mitinta.app'
      return Response.redirect(url.toString(), 308)
    }
    // Never let an unknown route fall back to HTML (especially backend.json).
    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (url.pathname === '/backend.json') {
      headers.set('Cache-Control', 'no-store')
      headers.set('Access-Control-Allow-Origin', '*')
    } else if (response.headers.get('Content-Type')?.includes('text/html')) {
      headers.set('Cache-Control', 'no-cache')
    }
    return new Response(response.body, { status: response.status, headers })
  },
}
