import type { CatalogCard } from './catalog'

export type CatalogSlot = CatalogCard & { pending?: true }

// Hyperia City: 204 base cards + 38 special printings, numbered through 242.
// https://wiki.mushureport.com/wiki/Hyperia_City
export const EXPECTED_SET_SIZES: Record<string, number> = { '14': 242 }

export function catalogSlots(cards: CatalogCard[]): CatalogSlot[] {
  const slots: CatalogSlot[] = [...cards]
  for (const [code, size] of Object.entries(EXPECTED_SET_SIZES)) {
    const setCards = cards.filter(card => card.set_code === code)
    if (!setCards.length) continue
    const knownNumbers = new Set(setCards.map(card => Number(card.collector_number)))
    for (let number = 1; number <= size; number++) {
      if (knownNumbers.has(number)) continue
      slots.push({
        id: `pending:${code}:${number}`, pending: true,
        name: 'Pendiente en el catálogo', version: '', set_code: code,
        set_name: setCards[0].set_name, collector_number: String(number),
        image_url: null, ink: null, rarity: '', card_type: '', cost: null,
        rules_text: null, language: 'en', normal_price_eur: null, foil_price_eur: null,
      })
    }
  }
  return slots
}
