import { describe, expect, it } from 'vitest'
import { availableDeckCatalog } from './deckCatalog'
import { allowsDeckInk, deckInkPolicy, validateDeck } from './deckRules'
import type { CatalogCard } from './catalog'
import type { DeckDraftEntry } from './deckDraft'
const printing = (id: string, ink: string | null, set = '13', name = id, version = ''): CatalogCard => ({ id, ink, set_code: set, name, version, set_name: `Set ${set}`, rarity: 'Common', collector_number: '1', image_url: null, card_type: 'Character', cost: 3, rules_text: '', language: 'en', normal_price_eur: null, foil_price_eur: null })
const entry = (card: CatalogCard): DeckDraftEntry => ({ ...card, card_id: card.id, card_name: card.name, card_version: card.version, quantity: 1 })
const date = '2026-10-04'
const ids = (cards: CatalogCard[]) => cards.map(card => card.id)
describe('automatic deck catalog', () => {
  it('offers current Core editions, retaining old reprints only in the existing list', () => {
    const old = printing('old', 'Amethyst', '1', 'Elsa', 'Snow Queen'), current = printing('current', 'Amethyst', '9', 'Elsa', 'Snow Queen')
    const rotated = printing('rotated', 'Amber', '8'), future = printing('future', 'Sapphire', '14')
    const entries = [entry(old)]
    expect(ids(availableDeckCatalog([old, current, rotated, future], entries, 'core', date))).toEqual(['current'])
    expect(entries[0].card_id).toBe('old')
    expect(ids(availableDeckCatalog([old, current, rotated, future], [], 'infinity', date))).toEqual(['old', 'current', 'rotated'])
  })
  it('allows all colours before choosing inks, and compatible second inks after the first', () => {
    const amethyst = printing('amethyst', 'Amethyst'), ruby = printing('ruby', 'Ruby'), dual = printing('dual', 'Ruby / Steel')
    const catalog = [amethyst, ruby, dual]
    expect(ids(availableDeckCatalog(catalog, [], 'core', date))).toEqual(['amethyst', 'ruby', 'dual'])
    expect(ids(availableDeckCatalog(catalog, [entry(amethyst)], 'core', date))).toEqual(['amethyst', 'ruby'])
  })
  it('restricts both halves of dual inks and unlocks immediately when an ink is removed', () => {
    const a = printing('a', 'Amethyst'), b = printing('b', 'Sapphire'), good = printing('good', 'Amethyst / Sapphire'), bad = printing('bad', 'Amethyst / Ruby'), ruby = printing('ruby', 'Ruby')
    const catalog = [a, b, good, bad, ruby]
    expect(ids(availableDeckCatalog(catalog, [entry(a), entry(b)], 'core', date))).toEqual(['a', 'b', 'good'])
    expect(ids(availableDeckCatalog(catalog, [entry(a)], 'core', date))).toEqual(['a', 'b', 'good', 'bad', 'ruby'])
  })
  it('honors Hunny exceptions without unlocking unrelated characters, versions or items', () => {
    const robin = printing('robin', 'Amethyst / Sapphire', '13', 'Christopher Robin', 'Hunny Sage')
    const tigger = printing('tigger', 'Ruby', '13', 'Tigger', 'Hunny Barbarian'), owl = printing('owl', 'Steel', '13', 'Owl', 'Hunny Ranger')
    const fake = printing('fake', 'Amber', '13', 'Tigger', 'Hunny Pirate'), ordinary = printing('ordinary', 'Ruby')
    const item = { ...tigger, id: 'item', card_type: 'Item' }
    const catalog = [robin, tigger, owl, fake, ordinary, item]
    expect(ids(availableDeckCatalog(catalog, [entry(robin)], 'core', date))).toEqual(['robin', 'tigger', 'owl'])
    expect(ids(availableDeckCatalog(catalog, [{ ...entry(robin), quantity: 0 }], 'core', date))).toContain('ordinary')
    const entries = [entry(robin), entry(tigger)]
    expect(validateDeck(entries).inksValid).toBe(true)
    expect(allowsDeckInk(deckInkPolicy(entries), entry(ordinary))).toBe(false)
  })
  it('applies format restrictions even to exempt Hunny cards and Infinity bans', () => {
    const robin = printing('robin', 'Amethyst / Sapphire', '13', 'Christopher Robin', 'Hunny Sage')
    const future = printing('future', 'Ruby', '14', 'Tigger', 'Hunny Barbarian')
    expect(ids(availableDeckCatalog([robin, future], [entry(robin)], 'core', date))).toEqual(['robin'])
    const hiram = printing('hiram', 'Sapphire', '2', 'Hiram Flaversham', 'Toymaker')
    expect(availableDeckCatalog([hiram], [], 'infinity', date)).toEqual([])
  })
})
