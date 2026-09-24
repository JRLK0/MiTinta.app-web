import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'frontend/public/catalog.json')
const LORCAST = 'https://api.lorcast.com/v0'
const CARDMARKET = 'https://downloads.s3.cardmarket.com/productCatalog'

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} al descargar ${url}`)
  return response.json()
}

function marketKey(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cardmarketName(card) {
  return marketKey(card.version ? `${card.name} - ${card.version}` : card.name)
}

function positive(...values) {
  return values.find((value) => typeof value === 'number' && value > 0) ?? null
}

function matchPrices(cards, products, guides) {
  const cardsBySet = Map.groupBy(cards, (card) => card.set.code)
  const productsByExpansion = Map.groupBy(products, (product) => product.idExpansion)
  const candidates = []
  for (const [setCode, setCards] of cardsBySet) {
    const names = new Set(setCards.map(cardmarketName))
    for (const [expansionId, expansionProducts] of productsByExpansion) {
      const overlap = new Set(expansionProducts.map((product) => marketKey(product.name)).filter((name) => names.has(name))).size
      if (overlap > 0) candidates.push({ setCode, expansionId, overlap })
    }
  }
  candidates.sort((left, right) => right.overlap - left.overlap)
  const assignedSets = new Set()
  const assignedExpansions = new Set()
  const expansionForSet = new Map()
  for (const candidate of candidates) {
    if (!assignedSets.has(candidate.setCode) && !assignedExpansions.has(candidate.expansionId)) {
      assignedSets.add(candidate.setCode)
      assignedExpansions.add(candidate.expansionId)
      expansionForSet.set(candidate.setCode, candidate.expansionId)
    }
  }
  const guidesByProduct = new Map(guides.map((guide) => [guide.idProduct, guide]))
  const result = new Map()
  for (const [setCode, setCards] of cardsBySet) {
    const expansionProducts = productsByExpansion.get(expansionForSet.get(setCode)) ?? []
    const cardsByName = Map.groupBy(setCards, cardmarketName)
    const productsByName = Map.groupBy(expansionProducts, (product) => marketKey(product.name))
    for (const [name, matchingCards] of cardsByName) {
      const matchingProducts = (productsByName.get(name) ?? []).sort((a, b) => a.idProduct - b.idProduct)
      matchingCards.sort((a, b) => (Number(a.collector_number) || Number.MAX_SAFE_INTEGER) - (Number(b.collector_number) || Number.MAX_SAFE_INTEGER))
      matchingCards.forEach((card, index) => {
        const guide = guidesByProduct.get(matchingProducts[index]?.idProduct)
        if (!guide) return
        result.set(card.id, {
          normal: positive(guide.trend, guide.avg7, guide.avg30, guide.avg, guide.low),
          foil: positive(guide['trend-foil'], guide['avg7-foil'], guide['avg30-foil'], guide['avg-foil'], guide['low-foil']),
        })
      })
    }
  }
  return result
}

function imageUrl(card) {
  const url = card.image_uris?.digital?.normal ?? card.image_uris?.digital?.small ?? null
  if (!url || !url.includes('cards.lorcast.io') || !url.includes('.avif')) return url
  return url.replace('/normal/', '/full/').replace('/small/', '/full/').replace('.avif', '.jpg')
}

const { results: sets } = await getJson(`${LORCAST}/sets`)
const cards = []
for (let index = 0; index < sets.length; index += 4) {
  const batch = sets.slice(index, index + 4)
  cards.push(...(await Promise.all(batch.map((set) => getJson(`${LORCAST}/sets/${encodeURIComponent(set.code)}/cards`)))).flat())
  process.stdout.write(`\rCatálogo: ${Math.min(index + 4, sets.length)}/${sets.length} colecciones`)
}

const [{ products }, { priceGuides }] = await Promise.all([
  getJson(`${CARDMARKET}/productList/products_singles_19.json`),
  getJson(`${CARDMARKET}/priceGuide/price_guide_19.json`),
])
const prices = matchPrices(cards, products, priceGuides)
const output = cards.map((card) => ({
  id: card.id,
  name: card.name,
  version: card.version ?? '',
  set_code: card.set.code,
  set_name: card.set.name,
  collector_number: card.collector_number,
  image_url: imageUrl(card),
  ink: card.inks?.length ? card.inks.join(' / ') : card.ink ?? null,
  rarity: card.rarity ?? '',
  card_type: card.type?.join(', ') ?? '',
  cost: card.cost ?? null,
  rules_text: card.text ?? null,
  language: card.lang ?? 'en',
  normal_price_eur: prices.get(card.id)?.normal ?? null,
  foil_price_eur: prices.get(card.id)?.foil ?? null,
}))

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify({ updated_at: new Date().toISOString(), cards: output }))
console.log(`\n${output.length} cartas guardadas; ${prices.size} con precio Cardmarket.`)
