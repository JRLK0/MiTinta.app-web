// Publish the existing cf build output through the documented Workers upload API.
// cf beta.14 hard-codes strict takeover checks and cannot deploy over an API upload in CI.
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { hash } from 'blake3-wasm'

const account = '5aa681405f165ae8194e10aacdb0d93e'
const root = '.cloudflare/output/v0/workers/default'
const config = JSON.parse(await readFile(`${root}/worker.config.json`, 'utf8'))
if (config.name !== 'mitinta-web' || Object.keys(config.env ?? {}).join(',') !== 'ASSETS' || config.env.ASSETS.type !== 'assets') {
  throw new Error('This publisher only supports the existing MiTinta static web Worker and ASSETS binding')
}
if (Object.keys(config.manifest?.modules ?? {}).length) throw new Error('Review additional Worker modules before deploying')
const main = config.manifest?.mainModule
if (main !== 'index.js') throw new Error('Unexpected Worker entrypoint')
const source = await readFile(`${root}/bundle/${main}`)
const manifest = {}, files = new Map()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.xml': 'application/xml', '.wasm': 'application/wasm' }
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) { await walk(file); continue }
    const content = await readFile(file), extension = path.extname(file)
    // Match cf/Wrangler hashes so unchanged assets do not need uploading again.
    const digest = hash(content.toString('base64') + extension.slice(1)).toString('hex').slice(0, 32)
    manifest['/' + path.relative(`${root}/assets`, file).split(path.sep).join('/')] = { hash: digest, size: content.length }
    files.set(digest, { file, type: types[extension] ?? 'application/octet-stream' })
  }
}
await walk(`${root}/assets`)
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ dryRun: true, worker: config.name, files: Object.keys(manifest).length, compatibilityDate: config.compatibilityDate }))
  process.exit(0)
}
if (process.env.MITINTA_CUSTOM_DOMAINS !== '1') throw new Error('Set MITINTA_CUSTOM_DOMAINS=1 for this production-only publisher')
if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is required')
async function api(route, { token = process.env.CLOUDFLARE_API_TOKEN, body, method = 'GET' } = {}) {
  const multipart = body instanceof FormData
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? multipart ? body : JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`Cloudflare ${method} ${route.split('?')[0]} failed: HTTP ${response.status}`)
  const result = await response.json()
  if (!result.success) throw new Error(`Cloudflare rejected ${method} ${route.split('?')[0]}`)
  return result.result
}
const remote = await api(`/workers/scripts/${config.name}/settings`)
if ((remote.bindings ?? []).some(binding => binding.name !== 'ASSETS' || binding.type !== 'assets')) {
  throw new Error('Remote Worker has additional bindings. Reconcile them before publishing.')
}
const domains = await api('/workers/domains')
for (const hostname of ['mitinta.app', 'www.mitinta.app']) {
  if (!domains.some(domain => domain.hostname === hostname && domain.service === config.name)) {
    throw new Error('Production domain routing changed. Review it before publishing.')
  }
}
const session = await api(`/workers/scripts/${config.name}/assets-upload-session`, { method: 'POST', body: { manifest } })
let completion = session.jwt, uploaded = 0
for (const bucket of session.buckets) {
  const form = new FormData()
  for (const digest of bucket) {
    const asset = files.get(digest)
    if (!asset) throw new Error('Cloudflare requested an unknown asset')
    form.append(digest, new Blob([(await readFile(asset.file)).toString('base64')], { type: asset.type }), digest)
    uploaded++
  }
  const result = await api('/workers/assets/upload?base64=true', { method: 'POST', token: session.jwt, body: form })
  if (result.jwt) completion = result.jwt
}
const metadata = {
  main_module: main, compatibility_date: config.compatibilityDate,
  compatibility_flags: config.compatibilityFlags ?? [], bindings: [{ name: 'ASSETS', type: 'assets' }],
  assets: { jwt: completion, config: { not_found_handling: 'none', run_worker_first: true } },
  observability: { enabled: true, redact_query_string: true, traces: { enabled: true, head_sampling_rate: 0.01 } },
}
const form = new FormData()
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
form.append(main, new Blob([source], { type: 'application/javascript+module' }), main)
const result = await api(`/workers/scripts/${config.name}`, { method: 'PUT', body: form })
console.log(JSON.stringify({ worker: config.name, uploaded, deploymentId: result.deployment_id }))
