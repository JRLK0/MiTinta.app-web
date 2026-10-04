import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeBase(value: string) {
  if (!value.startsWith('/')) throw new Error('La base de la portada debe empezar por /')
  return `${value.replace(/\/+$/, '')}/`.replace(/^\/\/$/, '/')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const configured = env.VITE_LANDING_BASE?.trim()
  const fromApp = env.VITE_BASE_PATH?.trim()
  const base = configured
    ? normalizeBase(configured)
    : fromApp === '/collection/'
      ? '/'
      : '/MiTinta.app-web/'

  return {
    root: 'landing',
    envDir: '.',
    publicDir: '../frontend/public',
    plugins: [react()],
    base,
    build: {
      outDir: '..',
      emptyOutDir: false,
      assetsDir: 'home-assets',
    },
  }
})
