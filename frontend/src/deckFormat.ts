import type { CatalogCard } from './catalog'
import type { DeckDraftEntry } from './deckDraft'
import { deckCardIdentity } from './deckRules'
import { preferredDeckPrinting } from './deckPrintingPreference'

export type DeckFormat = 'core' | 'infinity'
export const formatName = (format: DeckFormat) => format === 'core' ? 'Core' : 'Infinity'
// Tournament Rules 07/14/2026 §1.6; rotation and prerelease dates verified 2026-10-04.
// Unknown future sets never become legal just because their number is higher.
const mainSetDates: Record<string, string> = {
  '1': '2023-08-18', '2': '2023-11-17', '3': '2024-02-23', '4': '2024-05-17',
  '5': '2024-08-09', '6': '2024-11-15', '7': '2025-03-07', '8': '2025-05-30',
  '9': '2025-08-29', '10': '2025-11-07', '11': '2026-02-13', '12': '2026-05-08',
  '13': '2026-07-17', '14': '2026-10-16',
}
export type FormatCard = Pick<DeckDraftEntry, 'card_name' | 'card_version' | 'set_code' | 'ink'>
export type CardLegality = { legal: boolean; kind: 'legal' | 'reprint' | 'rotated' | 'banned' | 'unreleased' | 'unknown'; message: string; replacement?: CatalogCard }
export function buildFormatChecker(catalog: CatalogCard[], format: DeckFormat, date = new Date().toISOString().slice(0, 10)) {
  const index = new Map<string, CatalogCard[]>()
  for (const card of catalog) {
    const key = deckCardIdentity({ card_name: card.name, card_version: card.version })
    index.set(key, [...(index.get(key) ?? []), card])
  }
  const coreStart = date >= mainSetDates['13'] ? 9 : date >= mainSetDates['9'] ? 5 : 1
  return (card: FormatCard): CardLegality => {
    const key = deckCardIdentity(card)
    if (format === 'infinity' && key === deckCardIdentity({ card_name: 'Hiram Flaversham', card_version: 'Toymaker' })) {
      return { legal: false, kind: 'banned', message: 'Prohibida en Infinity: Hiram Flaversham — Toymaker.' }
    }
    const printings = index.get(key) ?? []
    const main = printings.filter(candidate => mainSetDates[candidate.set_code] && candidate.ink)
    const released = main.filter(candidate => mainSetDates[candidate.set_code] <= date)
    const eligible = released.filter(candidate => format === 'infinity' || Number(candidate.set_code) >= coreStart)
    const replacement = preferredDeckPrinting(eligible)
    if (replacement) {
      const currentSet = mainSetDates[card.set_code]
      if (format === 'core' && (!currentSet || Number(card.set_code) < coreStart)) {
        return { legal: true, kind: 'reprint', message: `Válida en Core por reimpresión en ${replacement.set_name}. Puedes conservar esta edición.`, replacement }
      }
      return { legal: true, kind: 'legal', message: `Válida en ${formatName(format)}.` }
    }
    if (main.length && !released.length) return { legal: false, kind: 'unreleased', message: `Todavía no válida en ${formatName(format)}: pendiente de lanzamiento (${mainSetDates[main[0].set_code]}).` }
    if (released.length && format === 'core') return { legal: false, kind: 'rotated', message: 'Fuera de Core: no tiene una reimpresión en los sets vigentes.' }
    return { legal: false, kind: 'unknown', message: `Legalidad sin confirmar en ${formatName(format)}: no consta una edición de un set construido válido.` }
  }
}

/** Switch an exact identity; consolidate a destination already in the list without losing copies. */
export function replaceDeckPrinting(entries: DeckDraftEntry[], sourceId: string, replacement: DeckDraftEntry) {
  const source = entries.find(entry => entry.card_id === sourceId)
  if (!source || sourceId === replacement.card_id || deckCardIdentity(source) !== deckCardIdentity(replacement)) return entries
  const destination = entries.find(entry => entry.card_id === replacement.card_id)
  return entries.filter(entry => entry.card_id !== replacement.card_id).map(entry => entry.card_id === sourceId
    ? { ...replacement, quantity: source.quantity + (destination?.quantity ?? 0) } : entry)
}
