import { writeFile } from 'node:fs/promises'

// LorcanaJSON supplies canonical product URLs, including alternate printings.
const response = await fetch('https://lorcanajson.org/files/current/en/allCards.json')
if (!response.ok) throw new Error(`No se pudieron descargar los enlaces: ${response.status}`)
const { cards } = await response.json()
const candidates = new Map()
for (const card of cards) {
  const url = card.externalLinks?.cardmarketUrl
  if (!url?.startsWith('https://www.cardmarket.com/en/Lorcana/Products/Singles/')) continue
  const key = `${card.promoGrouping ?? card.setCode}:${card.number}:${card.fullName}`
  const urls = candidates.get(key) ?? new Set()
  urls.add(url)
  candidates.set(key, urls)
}
// Ambiguous promotional variants use search rather than an arbitrary product.
const links = Object.fromEntries([...candidates].filter(([, urls]) => urls.size === 1).map(([key, urls]) => [key, [...urls][0]]))
await writeFile(new URL('../frontend/src/cardmarketLinks.generated.json', import.meta.url), `${JSON.stringify(links, null, 2)}\n`)
console.log(`${Object.keys(links).length} enlaces de Cardmarket guardados.`)
