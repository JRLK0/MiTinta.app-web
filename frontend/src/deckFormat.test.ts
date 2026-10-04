import { describe, expect, it } from 'vitest'
import { buildFormatChecker, replaceDeckPrinting } from './deckFormat'
import type { CatalogCard } from './catalog'
import type { DeckDraftEntry } from './deckDraft'
const printing = (id: string, set: string, name = 'Elsa', version = 'Snow Queen'): CatalogCard => ({ id, set_code: set, name, version, set_name: `Set ${set}`, ink: 'Amethyst', rarity: 'Common', collector_number: '1', image_url: null, card_type: 'Character', cost: 3, rules_text: '', language: 'en', normal_price_eur: 1, foil_price_eur: 2 })
const entry = (card: CatalogCard, quantity = 2): DeckDraftEntry => ({ ...card, card_id: card.id, card_name: card.name, card_version: card.version, quantity })
const today = '2026-10-04'
describe('constructed formats', () => {
  it('allows old printings by exact reprint and offers a regular current edition', () => {
    const old = printing('old', '1'), current = printing('new', '9')
    expect(buildFormatChecker([old, current], 'core', today)(entry(old))).toMatchObject({ legal: true, kind: 'reprint', replacement: current })
    expect(buildFormatChecker([old, current], 'core', today)(entry(current)).kind).toBe('legal')
  })
  it('never matches a different character version', () => {
    const old = printing('old', '1'), current = printing('new', '9', 'Elsa', 'Spirit of Winter')
    expect(buildFormatChecker([old, current], 'core', today)(entry(old))).toMatchObject({ legal: false, kind: 'rotated' })
    expect(buildFormatChecker([old, current], 'infinity', today)(entry(old)).legal).toBe(true)
  })
  it('uses the current separate ban list and does not retain obsolete Core bans', () => {
    const hiram = printing('hiram', '2', 'Hiram Flaversham', 'Toymaker'), fortisphere = printing('fortisphere', '4', 'Fortisphere', '')
    expect(buildFormatChecker([hiram, fortisphere], 'infinity', today)(entry(hiram)).kind).toBe('banned')
    expect(buildFormatChecker([fortisphere], 'infinity', today)(entry(fortisphere)).legal).toBe(true)
    expect(buildFormatChecker([printing('reprint', '9', 'Fortisphere', '')], 'core', today)(entry(fortisphere)).legal).toBe(true)
  })
  it('checks prerelease dates, including previews, without unlocking unknown sets', () => {
    const future = printing('future', '14'), promo = printing('promo', 'P4'), unknown = printing('unknown', '15')
    for (const format of ['core', 'infinity'] as const) {
      const check = buildFormatChecker([future, promo, unknown], format, today)
      expect(check(entry(future)).kind).toBe('unreleased')
      expect(check(entry(promo)).kind).toBe('unreleased')
      expect(check(entry(unknown)).legal).toBe(false)
      expect(buildFormatChecker([future], format, '2026-10-16')(entry(future)).legal).toBe(true)
    }
  })
  it('does not let a future reprint rescue a rotated card early', () => {
    const old = printing('old', '1'), future = printing('future', '14')
    expect(buildFormatChecker([old, future], 'core', today)(entry(old)).kind).toBe('rotated')
    expect(buildFormatChecker([old, future], 'core', '2026-10-16')(entry(old)).kind).toBe('reprint')
  })
  it('consolidates editions while preserving copies and rejecting a different identity', () => {
    const old = entry(printing('old', '1'), 3), current = entry(printing('new', '9'), 1)
    expect(replaceDeckPrinting([old, current], old.card_id, current)).toEqual([{ ...current, quantity: 4 }])
    expect(replaceDeckPrinting([old], old.card_id, entry(printing('other', '9', 'Anna')))).toEqual([old])
  })
  it('requires a main set printing for special scenario and unverified cards', () => {
    const scenario = printing('scenario', 'Q3')
    expect(buildFormatChecker([scenario], 'infinity', today)(entry(scenario)).kind).toBe('unknown')
  })
})
