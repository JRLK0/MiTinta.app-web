export type PriceHistoryPoint = {
  current: number
  previous: number | null
  observedAt: string
}

export type PriceHistory = Record<string, PriceHistoryPoint>

export type PriceObservation = {
  key: string
  price: number | null
}

export type PriceTrend = {
  amount: number
  percent: number
}

export function parsePriceHistory(value: string | null): PriceHistory {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as PriceHistory
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function updatePriceHistory(history: PriceHistory, observations: PriceObservation[], now = new Date().toISOString()): PriceHistory {
  const next = { ...history }
  observations.forEach(({ key, price }) => {
    if (price == null) return
    const stored = next[key]
    if (!stored) next[key] = { current: price, previous: null, observedAt: now }
    else if (Math.abs(stored.current - price) >= 0.005) {
      next[key] = { current: price, previous: stored.current, observedAt: now }
    }
  })
  return next
}

export function priceTrendFor(point: PriceHistoryPoint | undefined): PriceTrend | null {
  if (!point || point.previous == null || point.previous <= 0) return null
  const amount = point.current - point.previous
  if (Math.abs(amount) < 0.005) return null
  return { amount, percent: amount / point.previous * 100 }
}
