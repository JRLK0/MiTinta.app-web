import type { DeckDraftEntry } from './deckDraft'
import { validateDeck } from './deckRules'

export function deckLibrarySummary(entries: DeckDraftEntry[]) {
  const cards = entries.filter(entry => entry.quantity > 0)
  const rules = validateDeck(cards)
  const sets = cards.map(card => /^\d+$/.test(card.set_code.trim()) ? Number(card.set_code) : 0)
  const latestSet = Math.max(0, ...sets) || null
  return { total: rules.total, inks: rules.inks, baseInks: rules.baseInks, latestSet,
    previews: cards.filter(card => card.image_url).slice(0, 3) }
}
