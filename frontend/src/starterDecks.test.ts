import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveStarterDecks, starterDeckTotals } from './starterDecks'
import type { CatalogCard } from './catalog'

const catalog = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8')).cards as CatalogCard[]

describe('official starter decks', () => {
  it('resolves every printed card and keeps the two included foil copies separate', () => {
    const decks = resolveStarterDecks(catalog)
    expect(decks).toHaveLength(23)
    for (const deck of decks) {
      expect(deck.missing, deck.code).toEqual([])
      expect(starterDeckTotals(deck), deck.code).toEqual({ copies: 60, foil: 2 })
      expect(new Set(deck.cards.map(({ card, finish }) => `${card.id}-${finish}`)).size, deck.code).toBe(deck.cards.length)
    }
    const first = decks.find((deck) => deck.code === 'S1-1')!
    expect(first.cards.filter((item) => item.finish === 'FOIL').map((item) => item.card.collector_number)).toEqual(['14', '51'])
  })
})
