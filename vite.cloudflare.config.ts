import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  publicDir: './dist',
  plugins: [cloudflare()],
  build: { rollupOptions: { input: 'cloudflare/client-placeholder.js' } },
})
