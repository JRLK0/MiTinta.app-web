export type OwnedDeckCard = {
  card_name: string
  card_version: string
  quantity: number
}

export type RequiredDeckCard = OwnedDeckCard

export type PricedRequiredDeckCard = RequiredDeckCard & {
  normal_price_eur: number | null
}

export type DeckAvailability = {
  owned: number
  required: number
  remaining: number
  missing: number
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()
}

export function deckAvailabilityKey(name: string, version: string) {
  return normalize(`${name} - ${version}`)
}

export function buildDeckAvailability(collection: OwnedDeckCard[], entries: RequiredDeckCard[]) {
  const owned = new Map<string, number>()
  const required = new Map<string, number>()
  collection.forEach((card) => {
    const key = deckAvailabilityKey(card.card_name, card.card_version)
    owned.set(key, (owned.get(key) ?? 0) + card.quantity)
  })
  entries.forEach((card) => {
    const key = deckAvailabilityKey(card.card_name, card.card_version)
    required.set(key, (required.get(key) ?? 0) + card.quantity)
  })

  const result = new Map<string, DeckAvailability>()
  new Set([...owned.keys(), ...required.keys()]).forEach((key) => {
    const ownedCount = owned.get(key) ?? 0
    const requiredCount = required.get(key) ?? 0
    result.set(key, {
      owned: ownedCount,
      required: requiredCount,
      remaining: Math.max(ownedCount - requiredCount, 0),
      missing: Math.max(requiredCount - ownedCount, 0),
    })
  })
  return result
}

export function buildCardmarketMissingText(collection: OwnedDeckCard[], entries: RequiredDeckCard[]) {
  const availability = buildDeckAvailability(collection, entries)
  const labels = new Map<string, Pick<RequiredDeckCard, 'card_name' | 'card_version'>>()
  entries.forEach((entry) => {
    const key = deckAvailabilityKey(entry.card_name, entry.card_version)
    if (!labels.has(key)) labels.set(key, entry)
  })
  return Array.from(availability.entries())
    .flatMap(([key, counts]) => {
      const card = labels.get(key)
      if (!card || counts.missing === 0) return []
      const title = card.card_version.trim() ? `${card.card_name} - ${card.card_version}` : card.card_name
      return [{ title, quantity: counts.missing }]
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'es'))
    .map((card) => `${card.quantity} ${card.title}`)
    .join('\n')
}

export function buildDeckPriceSummary(collection: OwnedDeckCard[], entries: PricedRequiredDeckCard[]) {
  const availability = buildDeckAvailability(collection, entries)
  const unitPrices = new Map<string, number>()
  let deckValue = 0
  let deckUnpriced = 0

  entries.forEach((entry) => {
    const price = entry.normal_price_eur
    if (price == null || !Number.isFinite(price)) {
      deckUnpriced += entry.quantity
      return
    }
    deckValue += price * entry.quantity
    const key = deckAvailabilityKey(entry.card_name, entry.card_version)
    unitPrices.set(key, Math.min(unitPrices.get(key) ?? Number.POSITIVE_INFINITY, price))
  })

  let missingValue = 0
  let missingUnpriced = 0
  const missingPrices = new Map<string, { unitPrice: number | null; totalPrice: number | null }>()
  availability.forEach((counts, key) => {
    if (counts.missing === 0) return
    const unitPrice = unitPrices.get(key) ?? null
    if (unitPrice == null) {
      missingUnpriced += counts.missing
      missingPrices.set(key, { unitPrice: null, totalPrice: null })
      return
    }
    const totalPrice = unitPrice * counts.missing
    missingValue += totalPrice
    missingPrices.set(key, { unitPrice, totalPrice })
  })

  return { deckValue, deckUnpriced, missingValue, missingUnpriced, missingPrices }
}
