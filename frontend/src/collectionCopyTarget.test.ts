import { expect, it } from 'vitest'
import { collectionCopyTarget } from './collectionCopyTarget'

const normal = { card_id: 'card', set_code: '1', collector_number: '12', language: 'es', finish: 'NORMAL' as const, rarity: 'common', quantity: 1 }
const card = { id: 'catalog-card', setCode: '1', collectorNumber: '12' }

it('removes an owned copy even when it is in another language or catalogue ID', () => {
  expect(collectionCopyTarget([normal], card, 'NORMAL', -1)).toEqual({ card_id: 'card', language: 'es', finish: 'NORMAL' })
  expect(collectionCopyTarget([normal], { ...card, collectorNumber: '012' }, 'NORMAL', -1)?.language).toBe('es')
})
it('does not remove the other finish, another printing, or a zero quantity', () => {
  expect(collectionCopyTarget([normal], card, 'FOIL', -1)).toBeNull()
  expect(collectionCopyTarget([{ ...normal, quantity: 0 }], card, 'NORMAL', -1)).toBeNull()
  expect(collectionCopyTarget([normal], { ...card, collectorNumber: '13' }, 'NORMAL', -1)).toBeNull()
})
it('preserves the stored identity of a foil-only rarity and prefers the selected language', () => {
  expect(collectionCopyTarget([{ ...normal, rarity: 'enchanted' }], card, 'FOIL', -1)?.finish).toBe('NORMAL')
  expect(collectionCopyTarget([normal, { ...normal, language: 'en', card_id: 'english' }], card, 'NORMAL', -1)?.card_id).toBe('english')
  expect(collectionCopyTarget([normal], card, 'NORMAL', 1)).toEqual({ card_id: 'catalog-card', language: 'en', finish: 'NORMAL' })
})
