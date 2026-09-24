import { effectiveCardFinish, type CatalogCard } from './catalog'

const collectorNumberCollator = new Intl.Collator('es', {
  numeric: true,
  sensitivity: 'base',
})

const CARDMARKET_SET_CODES: Record<string, string> = {
  '1': '1TFC',
  '2': '2ROF',
  '3': '3INK',
  '4': '4URS',
  '5': '5SSK',
  '6': '6AZS',
  '7': '7ARI',
  '8': '8JAF',
  '9': '9FAB',
  '10': '10WHI',
  '11': '11WSP',
  '12': '12WIL',
  '13': '13ATV',
}

export const CARDMARKET_OPTIONAL_RARITIES = ['EPIC', 'ENCHANTED', 'ICONIC'] as const
export type CardmarketOptionalRarity = typeof CARDMARKET_OPTIONAL_RARITIES[number]
const CARDMARKET_OPTIONAL_RARITY_SET = new Set<string>(CARDMARKET_OPTIONAL_RARITIES)

export type CardFinishQuantities = {
  normal: number
  foil: number
  total: number
}

type CollectionPrinting = {
  card_id?: string
  set_code: string
  collector_number: string
}

export function printingKey(printing: CollectionPrinting) {
  const setCode = String(printing.set_code ?? '').trim().toLocaleLowerCase('en')
  const collectorNumber = String(printing.collector_number ?? '')
    .trim()
    .replace(/^0+(?=\d)/, '')
    .toLocaleLowerCase('en')
  return `${setCode}:${collectorNumber}`
}

export function collectionQuantitiesByPrinting(entries: Array<CollectionPrinting & { finish: 'NORMAL' | 'FOIL', quantity: number, rarity?: string }>) {
  const quantities = new Map<string, CardFinishQuantities>()
  entries.forEach((entry) => {
    const key = printingKey(entry)
    const quantity = Math.max(0, entry.quantity)
    const current = quantities.get(key) ?? { normal: 0, foil: 0, total: 0 }
    const finish = effectiveCardFinish(entry.rarity, entry.finish)
    if (finish === 'NORMAL') current.normal += quantity
    if (finish === 'FOIL') current.foil += quantity
    current.total += quantity
    quantities.set(key, current)
  })
  return quantities
}

export function compareCollectorNumbers(a: CatalogCard, b: CatalogCard) {
  return collectorNumberCollator.compare(a.collector_number, b.collector_number)
    || a.name.localeCompare(b.name, 'es')
}

function cardmarketTitle(card: CatalogCard) {
  return card.version ? `${card.name} - ${card.version}` : card.name
}

function cardmarketVersion(card: CatalogCard) {
  return CARDMARKET_OPTIONAL_RARITY_SET.has(card.rarity.toLocaleUpperCase('en')) ? ' (V.2)' : ''
}

export function filterCardmarketWants(cards: CatalogCard[], includedRarities: Iterable<CardmarketOptionalRarity> = []) {
  const included = new Set<string>(includedRarities)
  return cards.filter((card) => {
    const rarity = card.rarity.toLocaleUpperCase('en')
    return !CARDMARKET_OPTIONAL_RARITY_SET.has(rarity) || included.has(rarity)
  })
}

export function cardmarketWantsText(cards: CatalogCard[]) {
  return [...cards]
    .sort(compareCollectorNumbers)
    .map((card) => {
      const expansion = CARDMARKET_SET_CODES[card.set_code]
      return `1x ${cardmarketTitle(card)}${cardmarketVersion(card)}${expansion ? ` (${expansion})` : ''}`
    })
    .join('\r\n') + (cards.length ? '\r\n' : '')
}

export function cardmarketWantsChunks(cards: CatalogCard[], limit = 150) {
  const ordered = [...cards].sort(compareCollectorNumbers)
  const chunks: CatalogCard[][] = []
  for (let index = 0; index < ordered.length; index += limit) {
    chunks.push(ordered.slice(index, index + limit))
  }
  return chunks
}

export function safeSetFileName(setName: string) {
  return setName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
