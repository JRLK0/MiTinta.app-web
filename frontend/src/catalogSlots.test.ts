import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { CatalogCard } from './catalog'
import { catalogSlots } from './catalogSlots'

const cards = JSON.parse(readFileSync(new URL('../public/catalog.json', import.meta.url), 'utf8')).cards as CatalogCard[]

it('fills only missing Hyperia City numbers and preserves real printings', () => {
  const slots = catalogSlots(cards)
  const hyperia = slots.filter(card => card.set_code === '14')
  expect(new Set(hyperia.map(card => card.collector_number)).size).toBe(242)
  expect(hyperia.filter(card => card.pending)).toHaveLength(242 - new Set(cards.filter(card => card.set_code === '14').map(card => card.collector_number)).size)
  expect(hyperia.filter(card => card.pending).every(card => Number(card.collector_number) >= 205 && Number(card.collector_number) <= 240)).toBe(true)
  expect(slots.filter(card => !card.pending)).toEqual(cards)
})

it('replaces a pending slot when its real card arrives, without duplicates', () => {
  const newCard = { ...cards.find(card => card.set_code === '14')!, id: 'revealed-205', collector_number: '205' }
  const slots = catalogSlots([...cards, newCard]).filter(card => card.set_code === '14' && card.collector_number === '205')
  expect(slots).toEqual([newCard])
  expect(catalogSlots([])).toEqual([])
})
