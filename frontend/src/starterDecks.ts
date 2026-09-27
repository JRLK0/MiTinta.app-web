import deckData from './starterDecks.generated.json'
import type { CatalogCard, CardFinish } from './catalog'

export type StarterDeckCard = {
  card: CatalogCard
  quantity: number
  finish: CardFinish
}

export type StarterDeck = {
  code: string
  name: string
  setCode: string
  colors: string[]
  cards: StarterDeckCard[]
  missing: string[]
}

export const INK_NAMES: Record<string, string> = {
  Amber: 'Ámbar',
  Amethyst: 'Amatista',
  Emerald: 'Esmeralda',
  Ruby: 'Rubí',
  Sapphire: 'Zafiro',
  Steel: 'Acero',
}

export function resolveStarterDecks(catalog: CatalogCard[]): StarterDeck[] {
  const cardsByPrinting = new Map(catalog.map((card) => [`${card.set_code}/${card.collector_number}`, card]))
  return deckData.decks.map((deck) => {
    const cards: StarterDeckCard[] = []
    const missing: string[] = []
    for (const [setCode, number, quantity, finish] of deck.cards) {
      const card = cardsByPrinting.get(`${setCode}/${number}`)
      if (card) cards.push({ card, quantity: Number(quantity), finish: finish as CardFinish })
      else missing.push(`${setCode}/${number}`)
    }
    return { code: deck.code, name: deck.name, setCode: deck.code.split('-')[0].slice(1), colors: deck.colors, cards, missing }
  })
}

export function starterDeckTotals(deck: StarterDeck) {
  return {
    copies: deck.cards.reduce((sum, item) => sum + item.quantity, 0),
    foil: deck.cards.reduce((sum, item) => sum + (item.finish === 'FOIL' ? item.quantity : 0), 0),
  }
}
