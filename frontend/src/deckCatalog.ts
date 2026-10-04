import type { CatalogCard } from './catalog'
import type { DeckDraftEntry } from './deckDraft'
import { buildFormatChecker, type DeckFormat } from './deckFormat'
import { allowsDeckInk, deckInkPolicy } from './deckRules'

/** Automatic constraints only apply to candidates, never to the existing list. */
export function availableDeckCatalog(catalog: CatalogCard[], entries: DeckDraftEntry[], format: DeckFormat | null, date?: string) {
  const policy = deckInkPolicy(entries)
  const check = format ? buildFormatChecker(catalog, format, date) : null
  return catalog.filter(card => {
    const candidate = { card_name: card.name, card_version: card.version, ink: card.ink, card_type: card.card_type, set_code: card.set_code }
    if (!allowsDeckInk(policy, candidate)) return false
    const legality = check?.(candidate)
    // Core's picker favors current editions. Imported old editions remain legal
    // by exact reprint and retain their optional edition-switch action.
    return !legality || (legality.legal && (format !== 'core' || legality.kind !== 'reprint'))
  })
}
