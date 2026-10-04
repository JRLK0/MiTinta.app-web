import type { DeckDraftEntry } from './deckDraft'

// Construction exceptions verified against Attack of the Vine release notes
// and Lorcast classifications (2026-10-04). Match full identities, never "Hunny" in a name.
const hunnyCharacters = new Set([
  'Christopher Robin|Hunny Sage', 'Eeyore|Hunny Scholar', 'Gopher|Hunny Cook',
  'Kanga|Hunny Bard', 'Lumpy|Hunny Druid', 'Owl|Hunny Ranger',
  'Piglet|Hunny Mage Apprentice', 'Rabbit|Hunny Paladin', 'Roo|Hunny Rogue',
  'Tigger|Hunny Barbarian', 'Winnie the Pooh|Hunny Archmage',
  'Winnie the Pooh|Hunny Wizard', 'Winnie the Pooh & Piglet|Hunny Mages',
].map(normalize))

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

type CopyIdentity = Pick<DeckDraftEntry, 'card_name' | 'card_version'>
export function deckCardIdentity(entry: CopyIdentity) { return normalize(`${entry.card_name}|${entry.card_version}`) }
const identity = deckCardIdentity
export function deckCopyLimit(entry: CopyIdentity) {
  const key = identity(entry)
  return key === normalize('Dalmatian Puppy|Tail Wagger') ? 99 :
    key === normalize('Microbots|') ? Infinity : key === normalize('The Glass Slipper|') ? 2 : 4
}
export function deckCopyState(entries: DeckDraftEntry[], card: CopyIdentity) {
  const count = entries.filter(entry => identity(entry) === identity(card)).reduce((sum, entry) => sum + entry.quantity, 0)
  const limit = deckCopyLimit(card)
  return { count, limit, canAdd: count < limit }
}
export function changeDeckCopies(entries: DeckDraftEntry[], card: DeckDraftEntry, delta: number) {
  const state = deckCopyState(entries, card)
  if (delta > 0 && state.count + delta > state.limit) return entries
  const existing = entries.find(entry => entry.card_id === card.card_id)
  if (!existing) return delta > 0 ? [...entries, { ...card, quantity: delta }] : entries
  return entries.map(entry => entry.card_id === card.card_id ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry)
    .filter(entry => entry.quantity > 0)
}
export function cardInks(ink: string | null) { return ink?.split('/').map(value => value.trim()).filter(Boolean) ?? [] }

export function validateDeck(entries: DeckDraftEntry[]) {
  const active = entries.filter(entry => entry.quantity > 0)
  const total = active.reduce((sum, entry) => sum + entry.quantity, 0)
  const inks = Array.from(new Set(active.flatMap(entry => cardInks(entry.ink))))
  const hunnyEnabled = active.some(entry => identity(entry) === normalize('Christopher Robin|Hunny Sage'))
  const baseInks = hunnyEnabled ? ['Amethyst', 'Sapphire'] : inks
  const invalidInkCards = active.filter(entry => {
    if (!cardInks(entry.ink).length) return true
    if (!hunnyEnabled) return inks.length > 2
    const exempt = identity(entry) !== normalize('Christopher Robin|Hunny Sage') &&
      /\bCharacter\b/i.test(entry.card_type) && hunnyCharacters.has(identity(entry))
    return !exempt && cardInks(entry.ink).some(ink => !baseInks.includes(ink))
  })
  const copies = new Map<string, { count: number; limit: number; title: string }>()
  for (const entry of active) {
    const key = identity(entry)
    const limit = deckCopyLimit(entry)
    const previous = copies.get(key)
    copies.set(key, { count: (previous?.count ?? 0) + entry.quantity, limit, title: `${entry.card_name}${entry.card_version ? ` — ${entry.card_version}` : ''}` })
  }
  const copyErrors = [...copies.values()].filter(item => item.count > item.limit)
  const inksValid = invalidInkCards.length === 0
  const issues = [
    ...(total < 60 ? [`Faltan ${60 - total} cartas para el mínimo de 60.`] : []),
    ...(!inksValid ? [hunnyEnabled ? 'Fuera de Amatista/Zafiro solo se permiten otros personajes Hunny.' : 'El mazo admite un máximo de dos tintas. Las cartas de doble tinta cuentan como ambas.'] : []),
    ...copyErrors.map(item => `${item.title}: ${item.count} copias; máximo ${item.limit}.`),
  ]
  return { total, inks, baseInks, hunnyEnabled, inksValid, tooMany: copyErrors.length,
    issues, valid: total >= 60 && inksValid && copyErrors.length === 0 }
}
