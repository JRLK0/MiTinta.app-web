import { cardPrice } from './catalog'

export type CardKind = 'CHARACTER' | 'ACTION' | 'SONG' | 'ITEM' | 'LOCATION'
export type CostFilter = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9+'
export type PriceFilter = 'ALL' | '<1' | '1-5' | '5-20' | '20+' | 'NONE'
export type CommonSortMode = 'set' | 'name-asc' | 'name-desc' | 'cost-asc' | 'cost-desc' | 'price-asc' | 'price-desc' | 'rarity'

export type CardFilterState = {
  query: string
  setCode: string
  inks: string[]
  rarities: string[]
  types: CardKind[]
  costs: CostFilter[]
  price: PriceFilter
}

export type FilterableCard = {
  id: string
  name: string
  version: string
  setCode: string
  setName: string
  collectorNumber: string
  ink: string | null
  rarity: string
  cardType: string
  cost: number | null
  priceEur: number | null
  rulesText?: string | null
}

export type CollectionFilterSource = {
  card_id: string; language: string; finish: 'NORMAL' | 'FOIL'; card_name: string; card_version: string;
  set_code: string; set_name: string; collector_number: string; ink: string | null; rarity: string;
  normal_price_eur: number | null; foil_price_eur: number | null
}

export type CatalogFilterMetadata = { card_type: string; cost: number | null; rules_text: string | null }

export const EMPTY_CARD_FILTERS: CardFilterState = {
  query: '', setCode: 'ALL', inks: [], rarities: [], types: [], costs: [], price: 'ALL',
}

export const INK_OPTIONS = [
  { value: 'AMBER', label: 'Ámbar', color: '#e3a52a', aliases: ['AMBER', 'AMBAR', 'ÁMBAR'] },
  { value: 'AMETHYST', label: 'Amatista', color: '#9d62bd', aliases: ['AMETHYST', 'AMATISTA'] },
  { value: 'EMERALD', label: 'Esmeralda', color: '#27aa7c', aliases: ['EMERALD', 'ESMERALDA'] },
  { value: 'RUBY', label: 'Rubí', color: '#e34c58', aliases: ['RUBY', 'RUBI', 'RUBÍ'] },
  { value: 'SAPPHIRE', label: 'Zafiro', color: '#3c8ed0', aliases: ['SAPPHIRE', 'ZAFIRO'] },
  { value: 'STEEL', label: 'Acero', color: '#82909a', aliases: ['STEEL', 'ACERO'] },
] as const

export const RARITY_OPTIONS = [
  { value: 'COMMON', label: 'Común' },
  { value: 'UNCOMMON', label: 'Poco común' },
  { value: 'RARE', label: 'Rara' },
  { value: 'SUPER_RARE', label: 'Súper rara' },
  { value: 'LEGENDARY', label: 'Legendaria' },
  { value: 'ENCHANTED', label: 'Encantada' },
  { value: 'PROMO', label: 'Promocional' },
  { value: 'EPIC', label: 'Épica' },
  { value: 'ICONIC', label: 'Icónica' },
] as const

export const TYPE_OPTIONS: Array<{ value: CardKind; label: string }> = [
  { value: 'CHARACTER', label: 'Personaje' },
  { value: 'ACTION', label: 'Acción' },
  { value: 'SONG', label: 'Canción' },
  { value: 'ITEM', label: 'Objeto' },
  { value: 'LOCATION', label: 'Localización' },
]

export const COST_OPTIONS: CostFilter[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9+']

export function normalizeFilterText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function rarityKey(value: string) {
  return normalizeFilterText(value).replaceAll(' ', '_').toLocaleUpperCase('en')
}

export function cardKind(value: string): CardKind | null {
  const normalized = normalizeFilterText(value)
  if (normalized.includes('song')) return 'SONG'
  if (normalized.includes('character')) return 'CHARACTER'
  if (normalized.includes('action')) return 'ACTION'
  if (normalized.includes('item')) return 'ITEM'
  if (normalized.includes('location')) return 'LOCATION'
  return null
}

export function toggleFilterValue<Value extends string>(values: Value[], value: Value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function activeCardFilterCount(filters: CardFilterState) {
  return Number(Boolean(filters.query.trim())) + Number(filters.setCode !== 'ALL') + Number(filters.price !== 'ALL') +
    filters.inks.length + filters.rarities.length + filters.types.length + filters.costs.length
}

export function collectionCardForFilters(entry: CollectionFilterSource, metadata?: CatalogFilterMetadata): FilterableCard {
  return {
    id: `${entry.card_id}-${entry.language}-${entry.finish}`, name: entry.card_name, version: entry.card_version,
    setCode: entry.set_code, setName: entry.set_name, collectorNumber: entry.collector_number,
    ink: entry.ink, rarity: entry.rarity, cardType: metadata?.card_type ?? '', cost: metadata?.cost ?? null,
    priceEur: cardPrice(entry, entry.finish),
    rulesText: metadata?.rules_text,
  }
}

function matchesCost(cost: number | null, selected: CostFilter[]) {
  if (selected.length === 0) return true
  if (cost == null) return false
  return selected.some((value) => value === '9+' ? cost >= 9 : cost === Number(value))
}

function matchesPrice(price: number | null, selected: PriceFilter) {
  if (selected === 'ALL') return true
  if (selected === 'NONE') return price == null
  if (price == null) return false
  if (selected === '<1') return price < 1
  if (selected === '1-5') return price >= 1 && price < 5
  if (selected === '5-20') return price >= 5 && price < 20
  return price >= 20
}

export function filterCards(cards: FilterableCard[], filters: CardFilterState) {
  const needle = normalizeFilterText(filters.query)
  return cards.filter((card) => {
    const ink = (card.ink ?? '').toLocaleUpperCase('es')
    const kind = cardKind(card.cardType)
    const haystack = normalizeFilterText(`${card.name} ${card.version} ${card.setName} ${card.setCode} ${card.collectorNumber} ${card.rulesText ?? ''}`)
    return (!needle || haystack.includes(needle)) &&
      (filters.setCode === 'ALL' || card.setCode === filters.setCode) &&
      (filters.inks.length === 0 || filters.inks.some((selected) => INK_OPTIONS.find((option) => option.value === selected)?.aliases.some((alias) => ink.includes(alias)))) &&
      (filters.rarities.length === 0 || filters.rarities.includes(rarityKey(card.rarity))) &&
      (filters.types.length === 0 || (kind != null && filters.types.includes(kind))) &&
      matchesCost(card.cost, filters.costs) && matchesPrice(card.priceEur, filters.price)
  })
}

function collectorNumber(card: FilterableCard) {
  const number = Number.parseInt(card.collectorNumber, 10)
  return Number.isNaN(number) ? Number.MAX_SAFE_INTEGER : number
}

function compareNullable(a: number | null, b: number | null, direction: 1 | -1) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * direction
}

export function sortCards(cards: FilterableCard[], sort: CommonSortMode) {
  return [...cards].sort((a, b) => {
    if (sort === 'name-asc' || sort === 'name-desc') return a.name.localeCompare(b.name, 'es') * (sort === 'name-asc' ? 1 : -1)
    if (sort === 'cost-asc' || sort === 'cost-desc') return compareNullable(a.cost, b.cost, sort === 'cost-asc' ? 1 : -1)
    if (sort === 'price-asc' || sort === 'price-desc') return compareNullable(a.priceEur, b.priceEur, sort === 'price-asc' ? 1 : -1)
    if (sort === 'rarity') return rarityKey(a.rarity).localeCompare(rarityKey(b.rarity), 'es') || a.name.localeCompare(b.name, 'es')
    return a.setCode.localeCompare(b.setCode, 'es', { numeric: true }) || collectorNumber(a) - collectorNumber(b)
  })
}
