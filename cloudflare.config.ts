import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  accountId: '5aa681405f165ae8194e10aacdb0d93e',
  worker: {
    name: 'mitinta-web',
    entrypoint: './cloudflare/worker.ts',
    compatibilityDate: '2026-10-12',
    workersDev: true,
    domains: process.env.MITINTA_CUSTOM_DOMAINS === '1' ? ['mitinta.app', 'www.mitinta.app'] : [],
    env: { ASSETS: bindings.assets() },
    assets: { runWorkerFirst: true, notFoundHandling: 'none' },
    observability: { enabled: true, redactQueryString: true, traces: { enabled: true, headSamplingRate: 0.01 } },
  },
})
