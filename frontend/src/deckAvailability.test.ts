import { describe, expect, it } from 'vitest'
import { buildCardmarketMissingText, buildDeckAvailability, buildDeckPriceSummary, deckAvailabilityKey } from './deckAvailability'

describe('buildDeckAvailability', () => {
  it('shares owned copies between equivalent printings and finishes', () => {
    const result = buildDeckAvailability([
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2 },
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 1 },
    ], [
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2 },
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2 },
    ])

    expect(result.get(deckAvailabilityKey('Elsa', 'Spirit of Winter'))).toEqual({
      owned: 3,
      required: 4,
      remaining: 0,
      missing: 1,
    })
  })

  it('normalizes accents, case and whitespace in card identity', () => {
    const result = buildDeckAvailability([
      { card_name: 'Madrigál  ', card_version: '  Familia', quantity: 4 },
    ], [
      { card_name: 'MADRIGAL', card_version: 'familia', quantity: 1 },
    ])

    expect(result.get(deckAvailabilityKey('Madrigal', 'Familia'))?.remaining).toBe(3)
  })

  it('exports only missing quantities in Cardmarket deck-list format', () => {
    const text = buildCardmarketMissingText([
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 1 },
      { card_name: 'Mickey Mouse', card_version: 'Brave Little Tailor', quantity: 4 },
    ], [
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2 },
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2 },
      { card_name: 'Mickey Mouse', card_version: 'Brave Little Tailor', quantity: 4 },
    ])

    expect(text).toBe('3 Elsa - Spirit of Winter')
  })

  it('separates the complete deck value from the value of missing copies', () => {
    const summary = buildDeckPriceSummary([
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 1 },
    ], [
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2, normal_price_eur: 5 },
      { card_name: 'Elsa', card_version: 'Spirit of Winter', quantity: 2, normal_price_eur: 3 },
    ])

    expect(summary).toMatchObject({
      deckValue: 16,
      deckUnpriced: 0,
      missingValue: 9,
      missingUnpriced: 0,
    })
    expect(summary.missingPrices.get(deckAvailabilityKey('Elsa', 'Spirit of Winter'))).toEqual({
      unitPrice: 3,
      totalPrice: 9,
    })
  })

  it('reports missing copies whose approximate price is unavailable', () => {
    const summary = buildDeckPriceSummary([], [
      { card_name: 'Unknown', card_version: 'No Price', quantity: 2, normal_price_eur: null },
    ])

    expect(summary).toMatchObject({
      deckValue: 0,
      deckUnpriced: 2,
      missingValue: 0,
      missingUnpriced: 2,
    })
  })
})
