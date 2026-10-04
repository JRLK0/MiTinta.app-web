import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const githubPagesBase = '/MiTinta.app-web/collection/'

function normalizeBase(value: string | undefined) {
  const configured = value?.trim() || githubPagesBase
  if (!configured.startsWith('/')) throw new Error('VITE_BASE_PATH debe empezar por /')
  return `${configured.replace(/\/+$/, '')}/`
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '')
  if (command === 'build' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY para compilar la web')
  }
  return {
    root: 'frontend',
    plugins: [react()],
    base: normalizeBase(env.VITE_BASE_PATH),
    build: {
      outDir: '../collection',
      emptyOutDir: true,
    },
  }
})
