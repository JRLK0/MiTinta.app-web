import { describe, expect, it } from 'vitest'
import { preferredDeckPrinting, type DeckImportPrinting } from './deckPrintingPreference'

function printing(id: string, rarity: string, setCode: string, collectorNumber: string): DeckImportPrinting {
  return { id, rarity, set_code: setCode, collector_number: collectorNumber }
}

describe('preferredDeckPrinting', () => {
  it('chooses the ordinary printing instead of the enchanted printing regardless of catalog order', () => {
    const enchanted = printing('elsa-enchanted', 'Enchanted', '1', '207')
    const ordinary = printing('elsa-normal', 'Legendary', '1', '42')

    expect(preferredDeckPrinting([enchanted, ordinary])?.id).toBe('elsa-normal')
    expect(preferredDeckPrinting([ordinary, enchanted])?.id).toBe('elsa-normal')
  })

  it('prefers a standard set printing over a promotional printing', () => {
    expect(preferredDeckPrinting([
      printing('promo', 'Promo', 'P1', '38'),
      printing('standard', 'Legendary', '4', '58'),
    ])?.id).toBe('standard')
  })

  it('uses the earliest standard printing when several ordinary reprints exist', () => {
    expect(preferredDeckPrinting([
      printing('reprint', 'Legendary', '9', '43'),
      printing('original', 'Legendary', '1', '42'),
    ])?.id).toBe('original')
  })
})
