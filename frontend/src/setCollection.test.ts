import { describe, expect, it } from 'vitest'
import type { CatalogCard } from './catalog'
import { cardmarketWantsChunks, cardmarketWantsText, collectionQuantitiesByPrinting, compareCollectorNumbers, filterCardmarketWants, printingKey, safeSetFileName } from './setCollection'

function card(collectorNumber: string, overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    id: collectorNumber,
    name: `Carta ${collectorNumber}`,
    version: '',
    set_code: '11',
    set_name: 'Winterspell',
    collector_number: collectorNumber,
    image_url: null,
    ink: null,
    rarity: 'COMMON',
    card_type: 'Character',
    cost: 1,
    rules_text: null,
    language: 'en',
    normal_price_eur: null,
    foil_price_eur: null,
    ...overrides,
  }
}

describe('set collection helpers', () => {
  it('adds normal and foil copies for the same printing', () => {
    const quantities = collectionQuantitiesByPrinting([
      { set_code: '1', collector_number: '001', finish: 'NORMAL', quantity: 2 },
      { set_code: '1', collector_number: '1', finish: 'NORMAL', quantity: 1 },
      { set_code: '1', collector_number: '1', finish: 'FOIL', quantity: 1 },
      { set_code: '2', collector_number: '15', finish: 'FOIL', quantity: 2 },
    ])
    expect(quantities.get('1:1')).toEqual({ normal: 3, foil: 1, total: 4 })
    expect(quantities.get('2:15')).toEqual({ normal: 0, foil: 2, total: 2 })
  })

  it('keeps reprints in their actual set even when they share a logical card id', () => {
    const quantities = collectionQuantitiesByPrinting([
      { card_id: 'shared-card', set_code: '12', collector_number: '007', finish: 'NORMAL', quantity: 3 },
    ])

    expect(quantities.get(printingKey(card('7', { id: 'shared-card', set_code: '1' })))).toBeUndefined()
    expect(quantities.get(printingKey(card('7', { id: 'shared-card', set_code: '12' })))).toEqual({ normal: 3, foil: 0, total: 3 })
  })

  it('sorts collector numbers naturally', () => {
    const cards = [card('100'), card('9'), card('12'), card('P2-3'), card('P2-12')]
    expect(cards.sort(compareCollectorNumbers).map((item) => item.collector_number))
      .toEqual(['9', '12', '100', 'P2-3', 'P2-12'])
  })

  it('exports a Cardmarket wants list ordered by collector number', () => {
    const result = cardmarketWantsText([
      card('22', { name: 'Elsa', version: 'Ice Artisan' }),
      card('3', { name: 'Anna', version: 'Soothing Sister' }),
    ])
    expect(result).toBe('1x Anna - Soothing Sister (11WSP)\r\n1x Elsa - Ice Artisan (11WSP)\r\n')
  })

  it('uses Cardmarket expansion codes for the new collections', () => {
    expect(cardmarketWantsText([
      card('1', { set_code: '14', name: 'Hyperia' }),
      card('1', { set_code: 'P4', name: 'Promo' }),
      card('1', { set_code: 'CC1', name: 'Curator' }),
    ])).toBe('1x Curator (CC1)\r\n1x Hyperia (14HPC)\r\n1x Promo (PR4)\r\n')
  })

  it('marks epic, enchanted and iconic printings as Cardmarket version 2', () => {
    const result = cardmarketWantsText([
      card('205', { name: 'Tiana', version: 'Warm and Happy', rarity: 'Epic' }),
      card('227', { name: 'Anna', version: 'Soothing Sister', rarity: 'Enchanted' }),
      card('241', { name: 'Pocahontas', version: 'Peacekeeper', rarity: 'Iconic' }),
    ])
    expect(result).toBe([
      '1x Tiana - Warm and Happy (V.2) (11WSP)',
      '1x Anna - Soothing Sister (V.2) (11WSP)',
      '1x Pocahontas - Peacekeeper (V.2) (11WSP)',
      '',
    ].join('\r\n'))
  })

  it('excludes special rarities by default and includes only the selected ones', () => {
    const cards = [
      card('1'),
      card('205', { rarity: 'Epic' }),
      card('223', { rarity: 'Enchanted' }),
      card('241', { rarity: 'Iconic' }),
    ]
    expect(filterCardmarketWants(cards).map((item) => item.collector_number)).toEqual(['1'])
    expect(filterCardmarketWants(cards, ['EPIC', 'ICONIC']).map((item) => item.collector_number)).toEqual(['1', '205', '241'])
  })

  it('creates portable set file names', () => {
    expect(safeSetFileName('El Retorno de Úrsula!')).toBe('el-retorno-de-ursula')
  })

  it('splits large exports into Cardmarket-sized wants lists', () => {
    const chunks = cardmarketWantsChunks(Array.from({ length: 242 }, (_, index) => card(String(index + 1))))
    expect(chunks.map((chunk) => chunk.length)).toEqual([150, 92])
    expect(chunks[1][0].collector_number).toBe('151')
  })
})
