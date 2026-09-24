import { supabase } from './supabase'

export type CatalogCard = {
  id: string
  name: string
  version: string
  set_code: string
  set_name: string
  collector_number: string
  image_url: string | null
  ink: string | null
  rarity: string
  card_type: string
  cost: number | null
  rules_text: string | null
  language: string
  normal_price_eur: number | null
  foil_price_eur: number | null
}

export type CardFinish = 'NORMAL' | 'FOIL'

export function isFoilOnlyRarity(rarity?: string) {
  const key = (rarity ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  return ['epic', 'epica', 'enchanted', 'encantada', 'iconic', 'iconica'].includes(key)
}

export function effectiveCardFinish(rarity: string | undefined, requestedFinish: CardFinish): CardFinish {
  return isFoilOnlyRarity(rarity) ? 'FOIL' : requestedFinish
}

export function cardPrice(
  card: Pick<CatalogCard, 'rarity' | 'normal_price_eur' | 'foil_price_eur'>,
  requestedFinish: CardFinish = 'NORMAL',
) {
  return effectiveCardFinish(card.rarity, requestedFinish) === 'FOIL' ? card.foil_price_eur : card.normal_price_eur
}

type LorcastSet = { code: string; name: string }
type LorcastCard = {
  id: string
  name: string
  version?: string
  collector_number: string
  image_uris?: { digital?: { small?: string; normal?: string; large?: string } }
  ink?: string | null
  inks?: string[] | null
  rarity?: string
  type?: string[]
  cost?: number | null
  text?: string | null
  lang?: string
  set: LorcastSet
}

const LORCAST_URL = 'https://api.lorcast.com/v0'

function compatibleImageUrl(url?: string) {
  if (!url) return null
  if (!url.includes('cards.lorcast.io') || !url.includes('.avif')) return url
  return url.replace('/normal/', '/full/').replace('/small/', '/full/').replace('.avif', '.jpg')
}

function fromLorcast(card: LorcastCard): CatalogCard {
  return {
    id: card.id,
    name: card.name,
    version: card.version ?? '',
    set_code: card.set.code,
    set_name: card.set.name,
    collector_number: card.collector_number,
    image_url: compatibleImageUrl(card.image_uris?.digital?.normal ?? card.image_uris?.digital?.small),
    ink: card.inks?.length ? card.inks.join(' / ') : card.ink ?? null,
    rarity: card.rarity ?? '',
    card_type: card.type?.join(', ') ?? '',
    cost: card.cost ?? null,
    rules_text: card.text ?? null,
    language: card.lang ?? 'en',
    normal_price_eur: null,
    foil_price_eur: null,
  }
}

async function loadSupabaseCatalog() {
  const cards: CatalogCard[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('set_code')
      .order('collector_number')
      .range(start, start + 999)
    if (error) return []
    cards.push(...((data ?? []) as CatalogCard[]))
    if (!data || data.length < 1000) break
  }
  return cards
}

async function loadLorcastCatalog() {
  const setResponse = await fetch(`${LORCAST_URL}/sets`)
  if (!setResponse.ok) throw new Error('No se pudo descargar el catálogo de Lorcana.')
  const { results } = await setResponse.json() as { results: LorcastSet[] }
  const groups: CatalogCard[][] = []
  for (let index = 0; index < results.length; index += 4) {
    const batch = results.slice(index, index + 4)
    groups.push(...await Promise.all(batch.map(async (set) => {
      const response = await fetch(`${LORCAST_URL}/sets/${encodeURIComponent(set.code)}/cards`)
      if (!response.ok) throw new Error(`No se pudo descargar ${set.name}.`)
      return (await response.json() as LorcastCard[]).map(fromLorcast)
    })))
  }
  return groups.flat()
}

async function loadBundledCatalog() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}catalog.json`)
    if (!response.ok) return []
    const payload = await response.json() as { cards?: CatalogCard[] }
    return payload.cards ?? []
  } catch {
    return []
  }
}

let catalogPromise: Promise<CatalogCard[]> | null = null

export function loadCatalog() {
  catalogPromise ??= loadSupabaseCatalog().then(async (cards) => {
    if (cards.length >= 3_000) return cards
    const bundled = await loadBundledCatalog()
    return bundled.length ? bundled : loadLorcastCatalog()
  })
  return catalogPromise
}

export function cardTitle(card: Pick<CatalogCard, 'name' | 'version'>) {
  return card.version ? `${card.name} - ${card.version}` : card.name
}

function printingKey(card: Pick<CatalogCard, 'name' | 'version'>) {
  return `${card.name.trim().toLocaleLowerCase('en')}\u0000${card.version.trim().toLocaleLowerCase('en')}`
}

export function catalogReprints(cards: CatalogCard[]) {
  const groups = new Map<string, CatalogCard[]>()
  cards.forEach((card) => {
    const key = printingKey(card)
    groups.set(key, [...(groups.get(key) ?? []), card])
  })

  const result = new Map<string, CatalogCard[]>()
  groups.forEach((printings) => {
    if (new Set(printings.map((card) => card.set_code.toLocaleLowerCase('en'))).size < 2) return
    printings.forEach((printing) => {
      const otherSets = printings.filter((candidate, index, all) =>
        candidate.set_code.toLocaleLowerCase('en') !== printing.set_code.toLocaleLowerCase('en') &&
        all.findIndex((item) => item.set_code.toLocaleLowerCase('en') === candidate.set_code.toLocaleLowerCase('en')) === index,
      )
      result.set(printing.id, otherSets)
    })
  })
  return result
}
