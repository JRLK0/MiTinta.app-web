import { describe, expect, it } from 'vitest'
import { deckLibrarySummary } from './deckLibrary'
import type { DeckDraftEntry } from './deckDraft'

const card = (set: string, ink = 'Amethyst', quantity = 4): DeckDraftEntry => ({
  card_id: set, card_name: `Carta ${set}`, card_version: '', set_code: set, quantity,
  collector_number: '1', image_url: 'card.jpg', ink, card_type: 'Character', cost: 1,
  normal_price_eur: null, foil_price_eur: null,
})

describe('deck library summary', () => {
  it('uses the highest numeric set present, regardless of order', () => {
    expect(deckLibrarySummary([card('14'), card('2'), card('13')]).latestSet).toBe(14)
    expect(deckLibrarySummary([card('13'), card('2')]).latestSet).toBe(13)
  })
  it('ignores promotional codes and removed copies', () => {
    const summary = deckLibrarySummary([card('P1'), card('14', 'Ruby', 0), card('13', 'Sapphire')])
    expect(summary.latestSet).toBe(13)
    expect(summary.total).toBe(8)
    expect(summary.inks).toEqual(['Amethyst', 'Sapphire'])
  })
  it('handles empty decks and limits the real card preview', () => {
    expect(deckLibrarySummary([])).toMatchObject({ total: 0, latestSet: null, inks: [], previews: [] })
    expect(deckLibrarySummary([card('1'), card('2'), card('3'), card('4')]).previews).toHaveLength(3)
  })
})
