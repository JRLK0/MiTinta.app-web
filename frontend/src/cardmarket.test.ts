import { describe, expect, it } from 'vitest'
import { cardmarketLink } from './cardmarket'

describe('cardmarketLink', () => {
  it('links to the exact regular or promotional printing', () => {
    expect(cardmarketLink({ name: 'Ariel', version: 'On Human Legs', setCode: '1', collectorNumber: '1' })).toEqual({
      direct: true,
      url: 'https://www.cardmarket.com/en/Lorcana/Products/Singles/The-First-Chapter/Ariel-On-Human-Legs?language=1',
    })
    expect(cardmarketLink({ name: 'Mickey Mouse', version: 'Brave Little Tailor', setCode: 'P1', collectorNumber: '1' }).url).toContain('/Singles/Promos/Mickey-Mouse-Brave-Little-Tailor?')
  })

  it('searches by full title when a printing is unknown instead of linking to another edition', () => {
    const link = cardmarketLink({ name: 'Ariel', version: 'On Human Legs', setCode: 'unknown', collectorNumber: '1' })
    expect(link.direct).toBe(false)
    expect(new URL(link.url).pathname).toBe('/en/Lorcana/Products/Search')
    expect(new URL(link.url).searchParams.get('searchString')).toBe('Ariel - On Human Legs')
  })

  it('preserves punctuation and supports cards without a version or printing metadata', () => {
    const link = cardmarketLink({ name: 'A & B / ?', version: '' })
    expect(new URL(link.url).searchParams.get('searchString')).toBe('A & B / ?')
  })
})
