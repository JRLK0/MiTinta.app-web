import links from './cardmarketLinks.generated.json'

type MarketCard = { name: string; version: string; setCode?: string; collectorNumber?: string }

export function cardmarketLink(card: MarketCard) {
  const title = card.version ? `${card.name} - ${card.version}` : card.name
  const key = `${card.setCode}:${card.collectorNumber}:${title}`
  const productUrl = (links as Record<string, string>)[key]
  if (productUrl) return { url: productUrl, direct: true }
  const search = new URL('https://www.cardmarket.com/en/Lorcana/Products/Search')
  search.searchParams.set('searchString', title)
  return { url: search.href, direct: false }
}
