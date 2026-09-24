import { describe, expect, it } from 'vitest'
import { analyzeDeck, parseDeck, type CollectionCardForDeck } from './deckImport'

describe('parseDeck', () => {
  it('reads and merges Dreamborn text lines', () => {
    expect(parseDeck('4 Lumpy - Hunny Druid\n2x Lumpy - Hunny Druid\n3 Elsa - Snow Queen')).toEqual([
      { key: 'name:lumpy - hunny druid', name: 'Lumpy - Hunny Druid', count: 6 },
      { key: 'name:elsa - snow queen', name: 'Elsa - Snow Queen', count: 3 },
    ])
  })

  it('reads CSV using Dreamborn collection columns', () => {
    expect(parseDeck('Set Number,Card Number,Variant,Count\n1,042,normal,4')).toEqual([
      {
        key: 'printing:1:42',
        name: '1 #042',
        count: 4,
        setCode: '1',
        collectorNumber: '042',
      },
    ])
  })
})

describe('analyzeDeck', () => {
  it('combines finishes, languages, and reprints before calculating availability', () => {
    const collection: CollectionCardForDeck[] = [
      { card_id: '1-42', card_name: 'Lumpy', card_version: 'Hunny Druid', set_code: '1', collector_number: '42', image_url: 'one.jpg', quantity: 2 },
      { card_id: '1-42-foil', card_name: 'Lumpy', card_version: 'Hunny Druid', set_code: '1', collector_number: '42', image_url: 'one.jpg', quantity: 1 },
      { card_id: '9-10', card_name: 'Lumpy', card_version: 'Hunny Druid', set_code: '9', collector_number: '10', image_url: 'two.jpg', quantity: 2 },
    ]

    expect(analyzeDeck(parseDeck('4 Lumpy - Hunny Druid'), collection)[0]).toMatchObject({
      required: 4,
      owned: 5,
      missing: 0,
      remaining: 1,
      matched: true,
    })
  })
})
