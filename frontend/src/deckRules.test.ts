import { describe, expect, it } from 'vitest'
import { changeDeckCopies, deckCopyState, validateDeck } from './deckRules'
import type { DeckDraftEntry } from './deckDraft'

function card(name: string, version = '', ink = 'Amethyst', quantity = 1, id = name): DeckDraftEntry {
  return { card_id: id, card_name: name, card_version: version, ink, quantity, card_type: 'Character',
    set_code: '13', collector_number: '1', image_url: null, cost: 1, normal_price_eur: null, foil_price_eur: null }
}
const robin = card('Christopher Robin', 'Hunny Sage', 'Amethyst / Sapphire')

describe('constructed deck rules', () => {
  it('blocks the fifth copy from both an existing row and another printing', () => {
    const full = [card('Elsa', 'Snow Queen', 'Amethyst', 4, 'first')]
    expect(changeDeckCopies(full, full[0], 1)).toBe(full)
    expect(changeDeckCopies(full, card('Elsa', 'Snow Queen', 'Amethyst', 1, 'reprint'), 1)).toBe(full)
    expect(deckCopyState(full, full[0])).toEqual({ count: 4, limit: 4, canAdd: false })
  })
  it('aggregates editions before adding and unlocks after removing a copy', () => {
    const cards = [card('Elsa', 'Snow Queen', 'Amethyst', 2, 'a'), card('Elsa', 'Snow Queen', 'Amethyst', 1, 'b')]
    const full = changeDeckCopies(cards, cards[1], 1)
    expect(deckCopyState(full, cards[0]).canAdd).toBe(false)
    const reduced = changeDeckCopies(full, cards[0], -1)
    expect(deckCopyState(reduced, cards[0]).canAdd).toBe(true)
    expect(deckCopyState(changeDeckCopies(reduced, cards[0], 1), cards[0]).count).toBe(4)
  })
  it('allows removing imported excess and keeps different versions separate', () => {
    const excess = [card('Elsa', 'Snow Queen', 'Amethyst', 6)]
    expect(changeDeckCopies(excess, excess[0], -1)[0].quantity).toBe(5)
    expect(changeDeckCopies(excess, card('Elsa', 'Spirit', 'Amethyst', 1, 'spirit'), 1)).toHaveLength(2)
  })
  it('uses special copy limits in the actual add operation', () => {
    const slipper = [card('The Glass Slipper', '', 'Amber', 2)]
    expect(changeDeckCopies(slipper, slipper[0], 1)).toBe(slipper)
    const puppies = [card('Dalmatian Puppy', 'Tail Wagger', 'Amber', 99)]
    expect(changeDeckCopies(puppies, puppies[0], 1)).toBe(puppies)
    const bots = [card('Microbots', '', 'Sapphire', 120)]
    expect(changeDeckCopies(bots, bots[0], 1)[0].quantity).toBe(121)
  })
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
