import { describe, expect, it } from 'vitest'
import { analyzeDeck } from './deckAnalytics'

describe('analyzeDeck', () => {
  it('weights the cost curve and average by quantity', () => {
    const analysis = analyzeDeck([
      { quantity: 4, cost: 2, card_type: 'Character' },
      { quantity: 2, cost: 8, card_type: 'Action, Song' },
      { quantity: 1, cost: null, card_type: 'Item' },
    ])

    expect(analysis.curve.map((bucket) => bucket.count)).toEqual([0, 0, 4, 0, 0, 0, 0, 2])
    expect(analysis.averageCost).toBe(4)
    expect(analysis.highCostCards).toBe(2)
    expect(analysis.unknownCostCards).toBe(1)
    expect(analysis.maxCurveCount).toBe(4)
  })

  it('classifies Lorcana card types and omits empty groups', () => {
    const analysis = analyzeDeck([
      { quantity: 8, cost: 3, card_type: 'Character' },
      { quantity: 3, cost: 2, card_type: 'Action' },
      { quantity: 2, cost: 1, card_type: 'Location' },
    ])

    expect(analysis.types).toEqual([
      { label: 'Personajes', count: 8 },
      { label: 'Acciones', count: 3 },
      { label: 'Localizaciones', count: 2 },
    ])
  })
})
