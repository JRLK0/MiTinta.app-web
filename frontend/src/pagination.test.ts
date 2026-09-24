import { describe, expect, it } from 'vitest'
import { loadAllPages } from './pagination'

describe('loadAllPages', () => {
  it('loads collections larger than the Supabase row limit', async () => {
    const source = Array.from({ length: 1201 }, (_, index) => index)
    const ranges: Array<[number, number]> = []
    const result = await loadAllPages(async (from, to) => {
      ranges.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    }, 500)

    expect(result.data).toEqual(source)
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]])
  })

  it('stops and returns a page error', async () => {
    const result = await loadAllPages<number>(async () => ({ data: null, error: { message: 'offline' } }))
    expect(result).toEqual({ data: null, error: { message: 'offline' } })
  })
})
