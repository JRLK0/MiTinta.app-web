import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cardPrice, catalogReprints, effectiveCardFinish, isFoilOnlyRarity, type CatalogCard } from './catalog'

const payload = JSON.parse(
  readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8'),
) as { updated_at: string; cards: CatalogCard[] }

describe('bundled catalog', () => {
  it('contains the complete catalog with unique print ids', () => {
    expect(payload.cards.length).toBeGreaterThan(3_000)
    expect(new Set(payload.cards.map((card) => card.id)).size).toBe(payload.cards.length)
    expect(payload.cards.every((card) => card.name && card.set_code && card.collector_number)).toBe(true)
  })

  it('keeps Cardmarket coverage above 95 percent', () => {
    const priced = payload.cards.filter((card) => card.normal_price_eur != null || card.foil_price_eur != null)
    expect(priced.length / payload.cards.length).toBeGreaterThan(.95)
  })
})

describe('catalog reprints', () => {
  it('groups the same name and version when they appear in different sets', () => {
    const original = card('original', 'Pluto', 'Rescue Dog', '4')
    const reprint = card('reprint', 'pluto', 'rescue dog', '9')
    const otherVersion = card('other', 'Pluto', 'Guard Dog', '6')

    const result = catalogReprints([original, reprint, otherVersion])

    expect(result.get(original.id)).toEqual([reprint])
    expect(result.get(reprint.id)).toEqual([original])
    expect(result.has(otherVersion.id)).toBe(false)
  })

  it('does not treat alternate art in the same set as a reprint', () => {
    const standard = card('standard', 'Elsa', 'Snow Queen', '1')
    const alternate = card('alternate', 'Elsa', 'Snow Queen', '1')

    expect(catalogReprints([standard, alternate]).size).toBe(0)
  })
})

describe('foil-only rarities', () => {
  it.each(['Epic', 'Enchanted', 'Iconic', 'Épica', 'Encantada', 'Icónica'])('%s is always treated as foil', (rarity) => {
    expect(isFoilOnlyRarity(rarity)).toBe(true)
    expect(effectiveCardFinish(rarity, 'NORMAL')).toBe('FOIL')
    expect(cardPrice({ rarity, normal_price_eur: 10, foil_price_eur: 75 }, 'NORMAL')).toBe(75)
  })
})

function card(id: string, name: string, version: string, setCode: string): CatalogCard {
  return {
    id,
    name,
    version,
    set_code: setCode,
    set_name: `Set ${setCode}`,
    collector_number: '1',
    image_url: null,
    ink: 'Amber',
    rarity: 'Common',
    card_type: 'Character',
    cost: 1,
    rules_text: null,
    language: 'en',
    normal_price_eur: null,
    foil_price_eur: null,
  }
}
