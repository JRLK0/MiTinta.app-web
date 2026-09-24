import { describe, expect, it } from 'vitest'
import {
  collectionCardForFilters, EMPTY_CARD_FILTERS, filterCards, sortCards, type CardFilterState, type FilterableCard,
} from './cardFilters'

function card(overrides: Partial<FilterableCard>): FilterableCard {
  return {
    id: '1', name: 'Ariel', version: 'Cantante', setCode: '1', setName: 'Primer capítulo', collectorNumber: '2',
    ink: 'Amber', rarity: 'Common', cardType: 'Character', cost: 3, priceEur: 2, rulesText: null, ...overrides,
  }
}

function filters(overrides: Partial<CardFilterState>): CardFilterState {
  return { ...EMPTY_CARD_FILTERS, ...overrides }
}

describe('filtros comunes de cartas', () => {
  it('combina OR dentro de un grupo y AND entre grupos', () => {
    const cards = [
      card({ id: 'amber', ink: 'Amber', rarity: 'Rare', cost: 2 }),
      card({ id: 'ruby', ink: 'Ruby', rarity: 'Legendary', cost: 4 }),
      card({ id: 'wrong-rarity', ink: 'Amber', rarity: 'Common', cost: 2 }),
    ]
    const result = filterCards(cards, filters({ inks: ['AMBER', 'RUBY'], rarities: ['RARE', 'LEGENDARY'], costs: ['2', '4'] }))
    expect(result.map((value) => value.id)).toEqual(['amber', 'ruby'])
  })

  it('trata 9+ como cualquier coste desde nueve y oculta costes desconocidos solo si hay filtro', () => {
    const cards = [card({ id: 'nine', cost: 9 }), card({ id: 'twelve', cost: 12 }), card({ id: 'unknown', cost: null })]
    expect(filterCards(cards, filters({ costs: ['9+'] })).map((value) => value.id)).toEqual(['nine', 'twelve'])
    expect(filterCards(cards, filters({})).map((value) => value.id)).toContain('unknown')
  })

  it('clasifica Canción por separado de Acción', () => {
    const cards = [card({ id: 'song', cardType: 'Action, Song' }), card({ id: 'action', cardType: 'Action' })]
    expect(filterCards(cards, filters({ types: ['SONG'] })).map((value) => value.id)).toEqual(['song'])
    expect(filterCards(cards, filters({ types: ['ACTION'] })).map((value) => value.id)).toEqual(['action'])
  })

  it('busca sin tildes y ordena números de coleccionista numéricamente', () => {
    const cards = [card({ id: 'ten', name: 'Úrsula', collectorNumber: '10' }), card({ id: 'two', name: 'Úrsula', collectorNumber: '2' })]
    const result = sortCards(filterCards(cards, filters({ query: 'ursula' })), 'set')
    expect(result.map((value) => value.id)).toEqual(['two', 'ten'])
  })

  it('enriquece una entrada de colección con tipo y coste del catálogo', () => {
    const entry = {
      card_id: 'c1', language: 'en', finish: 'FOIL' as const, card_name: 'Ariel', card_version: 'Cantante',
      set_code: '1', set_name: 'Primer capítulo', collector_number: '2', ink: 'Amber', rarity: 'Rare',
      normal_price_eur: 2, foil_price_eur: 7,
    }
    const enriched = collectionCardForFilters(entry, { card_type: 'Action, Song', cost: 5, rules_text: 'Canta.' })
    expect(enriched).toMatchObject({ id: 'c1-en-FOIL', cardType: 'Action, Song', cost: 5, priceEur: 7, rulesText: 'Canta.' })
  })
})
