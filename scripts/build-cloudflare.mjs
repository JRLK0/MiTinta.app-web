import { mkdir, readFile, rm, cp, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { loadEnv } from 'vite'

const source = JSON.parse(await readFile(process.env.MITINTA_BACKEND_CONFIG_FILE ?? 'cloudflare/backend.json', 'utf8'))
const backend = { url: source.url, publishableKey: source.publishableKey,
  version: source.version, maintenance: source.maintenance }
const env = { ...loadEnv('production', '.', ''), ...process.env,
  VITE_SUPABASE_URL: backend.url, VITE_SUPABASE_PUBLISHABLE_KEY: backend.publishableKey,
  VITE_BASE_PATH: '/collection/', VITE_LANDING_BASE: '/',
  VITE_BACKEND_CONFIG_URL: '/backend.json' }
await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
for (const args of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build', '--outDir', '../dist/collection'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.landing.config.ts', '--outDir', '../dist'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
await cp('privacy', 'dist/privacy', { recursive: true })
await mkdir('dist/shared', { recursive: true })
await cp('shared/tokens.css', 'dist/shared/tokens.css')
if (!backend.url || !backend.publishableKey || !backend.version || typeof backend.maintenance !== 'boolean') {
  throw new Error('Configuración pública de backend incompleta')
}
const target = new URL(backend.url)
const anonymousJwt = (() => {
  try { return JSON.parse(Buffer.from(backend.publishableKey.split('.')[1], 'base64url')).role === 'anon' }
  catch { return false }
})()
if (target.protocol !== 'https:' || target.username || target.password || target.port ||
    target.pathname !== '/' || target.search || target.hash ||
    !['api.mitinta.app', 'wedzkhkkqilokvfmzyuv.supabase.co'].includes(target.hostname) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(backend.version) ||
    !(backend.publishableKey.startsWith('sb_publishable_') || anonymousJwt)) {
  throw new Error('Solo se puede publicar una conexión autorizada con clave anónima/publicable')
}
await writeFile('dist/backend.json', JSON.stringify(backend) + '\n')
const result = spawnSync(process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.cloudflare.config.ts'],
  { env, stdio: 'inherit' })
process.exit(result.status ?? 1)
