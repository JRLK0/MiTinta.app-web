import { describe, expect, it } from 'vitest'
import { deckEditorFingerprint, parseDeckDraft, serializeDeckDraft, type DeckEditorState } from './deckDraft'

const editor: DeckEditorState = {
  activeId: 'deck-1',
  name: 'Rubí Acero',
  description: 'Borrador competitivo',
  isPublic: false,
  entries: [{
    card_id: 'card-1', quantity: 4, card_name: 'Mickey Mouse', card_version: 'Héroe',
    set_code: '1', collector_number: '1', image_url: null, ink: 'Ruby', card_type: 'Character',
    cost: 3, normal_price_eur: 2, foil_price_eur: 4,
  }],
}

describe('deck drafts', () => {
  it('restores quantities above 99 for cards without a construction limit', () => {
    const large = { ...editor, entries: [{ ...editor.entries[0], quantity: 120, card_name: 'Microbots', card_version: '' }] }
    expect(parseDeckDraft(serializeDeckDraft('user-1', large), 'user-1')).toMatchObject(large)
  })
  it('round-trips a draft only for its owner', () => {
    const serialized = serializeDeckDraft('user-1', editor, '2026-08-21T12:00:00Z')
    expect(parseDeckDraft(serialized, 'user-1')).toMatchObject(editor)
    expect(parseDeckDraft(serialized, 'user-2')).toBeNull()
  })

  it('rejects damaged entries and fingerprints entries independent of order', () => {
    expect(parseDeckDraft('{"version":1}', 'user-1')).toBeNull()
    const reversed = { ...editor, entries: [...editor.entries].reverse() }
    expect(deckEditorFingerprint(reversed)).toBe(deckEditorFingerprint(editor))
  })
})
