import { describe, expect, it } from 'vitest'
import { validateDeck } from './deckRules'
import type { DeckDraftEntry } from './deckDraft'

function card(name: string, version = '', ink = 'Amethyst', quantity = 1, id = name): DeckDraftEntry {
  return { card_id: id, card_name: name, card_version: version, ink, quantity, card_type: 'Character',
    set_code: '13', collector_number: '1', image_url: null, cost: 1, normal_price_eur: null, foil_price_eur: null }
}
const robin = card('Christopher Robin', 'Hunny Sage', 'Amethyst / Sapphire')

describe('constructed deck rules', () => {
  it('requires at least 60 cards and permits more than 60', () => {
    expect(validateDeck([card('Microbots', '', 'Sapphire', 59)]).valid).toBe(false)
    expect(validateDeck([card('Microbots', '', 'Sapphire', 61)]).valid).toBe(true)
  })
  it('counts both inks of a dual ink card', () => {
    expect(validateDeck([robin, card('Mickey', '', 'Ruby')]).inksValid).toBe(false)
    expect(validateDeck([robin, card('Mickey', '', 'Sapphire')]).inksValid).toBe(true)
  })
  it('permits only verified other Hunny characters outside the Robin base', () => {
    expect(validateDeck([robin, card('Tigger', 'Hunny Barbarian', 'Ruby'), card('Owl', 'Hunny Ranger', 'Steel')]).inksValid).toBe(true)
    expect(validateDeck([robin, card('Winnie the Pooh', 'Hunny Pirate', 'Amber')]).inksValid).toBe(false)
    expect(validateDeck([robin, { ...card('Tigger', 'Hunny Barbarian', 'Ruby'), card_type: 'Item' }]).inksValid).toBe(false)
    expect(validateDeck([card('Tigger', 'Hunny Barbarian', 'Ruby'), card('Owl', 'Hunny Ranger', 'Steel'), card('Roo', 'Hunny Rogue', 'Emerald')]).inksValid).toBe(false)
  })
  it('removes the exception when the last Robin is removed', () => {
    const cards = [robin, card('Tigger', 'Hunny Barbarian', 'Ruby'), card('Owl', 'Hunny Ranger', 'Steel'), card('Roo', 'Hunny Rogue', 'Emerald')]
    expect(validateDeck(cards).inksValid).toBe(true)
    expect(validateDeck(cards.map(entry => entry === robin ? { ...entry, quantity: 0 } : entry)).inksValid).toBe(false)
  })
  it('aggregates reprints by full identity, keeping versions separate', () => {
    expect(validateDeck([card('Elsa', 'Snow Queen', 'Amethyst', 3, 'a'), card('Elsa', 'Snow Queen', 'Amethyst', 2, 'b')]).tooMany).toBe(1)
    expect(validateDeck([card('Elsa', 'Snow Queen', 'Amethyst', 4), card('Elsa', 'Spirit', 'Amethyst', 4)]).tooMany).toBe(0)
  })
  it('honors the special copy limits', () => {
    expect(validateDeck([card('Dalmatian Puppy', 'Tail Wagger', 'Amber', 99)]).valid).toBe(true)
    expect(validateDeck([card('Dalmatian Puppy', 'Tail Wagger', 'Amber', 99, 'a'), card('Dalmatian Puppy', 'Tail Wagger', 'Amber', 1, 'b')]).tooMany).toBe(1)
    expect(validateDeck([card('The Glass Slipper', '', 'Amber', 3)]).tooMany).toBe(1)
    expect(validateDeck([card('The Glass Slipper', '', 'Amber', 2)]).tooMany).toBe(0)
    expect(validateDeck([card('Microbots', '', 'Sapphire', 120)]).valid).toBe(true)
  })
})
