import { afterEach, expect, it, vi } from 'vitest'
import { loadCatalog } from './catalog'

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => ({ order: () => ({
      range: async () => ({ data: [], error: null }),
    }) }) }) }),
  },
}))

afterEach(() => vi.unstubAllGlobals())

it('revalidates the bundled catalog instead of using a fresh but outdated browser cache', async () => {
  const latestCard = { id: 'new-hyperia-card', set_code: '14' }
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cards: [latestCard] }) })
  vi.stubGlobal('fetch', fetchMock)

  expect(await loadCatalog()).toEqual([latestCard])
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('catalog.json'), { cache: 'no-cache' })
})
