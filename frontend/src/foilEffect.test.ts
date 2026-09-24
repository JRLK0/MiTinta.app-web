import { describe, expect, it } from 'vitest'
import { foilHasTopLayer, foilMaskUrls, foilProfileCount, foilProfileFor } from './foilEffect'

describe('foilProfileFor', () => {
  it.each([
    ['4-P3', '15', 'calendar-wave'],
    ['10', '2', 'free-form-1'],
    ['1-D23', '1', 'free-form-2'],
    ['5', '223', 'glitter'],
    ['1', '205', 'lava'],
    ['9', '241', 'lore'],
    ['9', '228', 'magma'],
    ['12-P3', '57', 'rainbow-pillars'],
    ['1-CC1', '1', 'satin'],
    ['6-P2', '8', 'sea-wave'],
    ['1', '1', 'silver'],
    ['1-C1', '1', 'tempest'],
    ['5', '205', 'vertical-wave'],
  ])('uses the synchronized finish for %s-%s (%s)', (setCode, collectorNumber, expected) => {
    expect(foilProfileFor({ setCode, collectorNumber, rarity: 'Rare' })).toBe(expected)
  })

  it('keeps a rarity-based fallback for future cards not in the synchronized list', () => {
    expect(foilProfileFor({ setCode: '999', collectorNumber: '999', rarity: 'Enchanted' })).toBe('magma')
  })

  it('contains the complete current Duels.ink foil catalogue', () => {
    expect(foilProfileCount()).toBeGreaterThan(3000)
  })

  it('knows Dumbo has its own top foil layer', () => {
    expect(foilHasTopLayer({ setCode: '9', collectorNumber: '228' })).toBe(true)
  })
})

describe('foilMaskUrls', () => {
  it('builds the real print mask URL and normalizes padded numbers', () => {
    expect(foilMaskUrls({ setCode: '09', collectorNumber: '0228' })).toEqual({
      cardKey: '9-228',
      image: 'https://cards.duels.ink/lorcana/en/full/9-228.webp',
      mask: 'https://cards.duels.ink/lorcana/en/foil-masks/9-228.webp',
      topMask: 'https://cards.duels.ink/lorcana/en/foil-top-masks/9-228.webp',
    })
  })

  it('does not invent a mask without a complete printing identity', () => {
    expect(foilMaskUrls({ setCode: '9' })).toBeNull()
  })
})
