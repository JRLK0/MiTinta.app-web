export type DeckImportPrinting = {
  id: string
  rarity: string
  set_code: string
  collector_number: string
}

function normalizedRarity(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z]/g, '')
}

function printingRank(card: DeckImportPrinting) {
  const rarity = normalizedRarity(card.rarity)
  if (rarity === 'enchanted') return 3
  if (rarity === 'promo' || rarity === 'promotional') return 2
  return /^\d+$/.test(card.set_code.trim()) ? 0 : 1
}

function sortableNumber(value: string) {
  return Number.parseInt(value, 10) || Number.MAX_SAFE_INTEGER
}

/** Chooses the ordinary playable printing when a deck line does not specify an exact set and number. */
export function preferredDeckPrinting<T extends DeckImportPrinting>(cards: T[]): T | undefined {
  return [...cards].sort((left, right) =>
    printingRank(left) - printingRank(right) ||
    sortableNumber(left.set_code) - sortableNumber(right.set_code) ||
    sortableNumber(left.collector_number) - sortableNumber(right.collector_number) ||
    left.id.localeCompare(right.id),
  )[0]
}
