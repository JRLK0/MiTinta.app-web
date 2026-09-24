import { describe, expect, it } from 'vitest'
import { priceTrendFor, updatePriceHistory } from './priceHistory'

describe('price history', () => {
  it('keeps the last real observed price when a price changes', () => {
    const first = updatePriceHistory({}, [{ key: 'card', price: 2 }], 'first')
    const second = updatePriceHistory(first, [{ key: 'card', price: 2.5 }], 'second')

    expect(second.card).toEqual({ current: 2.5, previous: 2, observedAt: 'second' })
    expect(priceTrendFor(second.card)).toEqual({ amount: 0.5, percent: 25 })
  })

  it('does not create a false change for an unchanged or missing price', () => {
    const history = updatePriceHistory({}, [{ key: 'card', price: 2 }], 'first')
    expect(updatePriceHistory(history, [{ key: 'card', price: 2 }, { key: 'other', price: null }], 'second')).toEqual(history)
    expect(priceTrendFor(history.card)).toBeNull()
  })
})
