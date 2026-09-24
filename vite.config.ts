import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const githubPagesBase = '/lorcana-lector-web/collection/'

function normalizeBase(value: string | undefined) {
  const configured = value?.trim() || githubPagesBase
  if (!configured.startsWith('/')) throw new Error('VITE_BASE_PATH debe empezar por /')
  return `${configured.replace(/\/+$/, '')}/`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
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
