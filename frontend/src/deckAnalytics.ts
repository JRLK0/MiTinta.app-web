export type DeckAnalyticsEntry = {
  quantity: number
  cost: number | null
  card_type: string
}

export type DeckType = 'Personajes' | 'Acciones' | 'Canciones' | 'Objetos' | 'Localizaciones' | 'Otros'

const TYPE_ORDER: DeckType[] = ['Personajes', 'Acciones', 'Canciones', 'Objetos', 'Localizaciones', 'Otros']

function deckType(value: string): DeckType {
  const type = value.toLocaleLowerCase('en')
  if (type.includes('song')) return 'Canciones'
  if (type.includes('character')) return 'Personajes'
  if (type.includes('item')) return 'Objetos'
  if (type.includes('location')) return 'Localizaciones'
  if (type.includes('action')) return 'Acciones'
  return 'Otros'
}

export function analyzeDeck(entries: DeckAnalyticsEntry[]) {
  const curve = Array.from({ length: 8 }, (_, index) => ({
    label: index === 7 ? '7+' : String(index),
    count: 0,
  }))
  const typeCounts = new Map<DeckType, number>(TYPE_ORDER.map((type) => [type, 0]))
  let knownCostCards = 0
  let totalCost = 0
  let unknownCostCards = 0
  let highCostCards = 0

  for (const entry of entries) {
    const quantity = Math.max(0, entry.quantity)
    typeCounts.set(deckType(entry.card_type), (typeCounts.get(deckType(entry.card_type)) ?? 0) + quantity)
    if (entry.cost == null || !Number.isFinite(entry.cost)) {
      unknownCostCards += quantity
      continue
    }
    const cost = Math.max(0, entry.cost)
    curve[Math.min(Math.floor(cost), 7)].count += quantity
    knownCostCards += quantity
    totalCost += cost * quantity
    if (cost >= 6) highCostCards += quantity
  }

  return {
    curve,
    types: TYPE_ORDER.map((label) => ({ label, count: typeCounts.get(label) ?? 0 })).filter((item) => item.count > 0),
    averageCost: knownCostCards > 0 ? totalCost / knownCostCards : 0,
    unknownCostCards,
    highCostCards,
    maxCurveCount: Math.max(1, ...curve.map((bucket) => bucket.count)),
  }
}
