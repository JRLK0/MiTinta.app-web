import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it.each(['MiTinta.app-web', 'lorcana-lector-web', 'MiTinta.app'])('preserves recovery links from %s without loading authentication', (repository) => {
  const replace = vi.fn()
  const script = readFileSync(new URL('../../legacy/redirect.js', import.meta.url), 'utf8')
  runInNewContext(script, { URL, window: { location: {
    pathname: `/${repository}/collection/`, search: '?deck=synthetic', hash: '#type=recovery&access_token=synthetic', replace,
  } } })
  expect(replace).toHaveBeenCalledWith('https://mitinta.app/collection/?deck=synthetic#type=recovery&access_token=synthetic')
  const html = readFileSync(new URL('../../legacy/collection.html', import.meta.url), 'utf8')
  expect(html).toContain('Content-Security-Policy')
  expect(html).not.toMatch(/supabase|assets\/index|type="module"/)
})
