import Papa from 'papaparse'

export type DeckRequirement = {
  key: string
  name: string
  count: number
  setCode?: string
  collectorNumber?: string
}

export type CollectionCardForDeck = {
  card_id: string
  card_name: string
  card_version: string
  set_code: string
  collector_number: string
  image_url: string | null
  quantity: number
}

export type DeckAvailability = {
  key: string
  name: string
  version: string
  imageUrl: string | null
  required: number
  owned: number
  missing: number
  remaining: number
  matched: boolean
}

const COUNT_HEADERS = ['count', 'quantity', 'qty', 'amount', 'copies']
const NAME_HEADERS = ['name', 'card', 'cardname', 'fullname']
const SET_HEADERS = ['set', 'setnumber', 'setcode']
const NUMBER_HEADERS = ['number', 'cardnumber', 'collectornumber']

function normalizedHeader(value: string) {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')
}

function normalizedText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[’]/g, "'")
    .trim()
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
}

function normalizedCollectorNumber(value: string) {
  const trimmed = value.trim()
  return /^\d+$/.test(trimmed) ? String(Number(trimmed)) : normalizedText(trimmed)
}

function playableName(card: CollectionCardForDeck) {
  return card.card_version.trim()
    ? `${card.card_name} - ${card.card_version}`
    : card.card_name
}

function firstValue(row: Record<string, string>, names: string[]) {
  const key = Object.keys(row).find((candidate) => names.includes(candidate))
  return key ? row[key]?.trim() : undefined
}

function mergeRequirements(rows: DeckRequirement[]) {
  const merged = new Map<string, DeckRequirement>()
  rows.forEach((row) => {
    const previous = merged.get(row.key)
    merged.set(row.key, previous ? { ...previous, count: previous.count + row.count } : row)
  })
  return Array.from(merged.values())
}

function parseCsvDeck(content: string): DeckRequirement[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizedHeader,
  })
  const rows = result.data.flatMap((row) => {
    const count = Number(firstValue(row, COUNT_HEADERS))
    if (!Number.isInteger(count) || count <= 0) return []
    const name = firstValue(row, NAME_HEADERS)
    const setCode = firstValue(row, SET_HEADERS)
    const collectorNumber = firstValue(row, NUMBER_HEADERS)
    if (setCode && collectorNumber) {
      return [{
        key: `printing:${normalizedText(setCode)}:${normalizedCollectorNumber(collectorNumber)}`,
        name: name || `${setCode} #${collectorNumber}`,
        count,
        setCode,
        collectorNumber,
      }]
    }
    if (!name) return []
    return [{ key: `name:${normalizedText(name)}`, name, count }]
  })
  return mergeRequirements(rows)
}

function parseTextDeck(content: string): DeckRequirement[] {
  const ignoredSection = /^(deck|main deck|mainboard|sideboard|characters?|actions?|items?|locations?|songs?)\s*:?.*$/i
  const rows = content.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.trim().replace(/^[-*]\s*/, '')
    if (!line || ignoredSection.test(line)) return []
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i)
    if (!match) return []
    const count = Number(match[1])
    const name = match[2].trim()
    if (!name || count <= 0) return []
    return [{ key: `name:${normalizedText(name)}`, name, count }]
  })
  return mergeRequirements(rows)
}

export function parseDeck(content: string): DeckRequirement[] {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Pega una lista o selecciona un archivo de mazo.')
  const firstLine = trimmed.split(/\r?\n/, 1)[0]
  const requirements = firstLine.includes(',') ? parseCsvDeck(trimmed) : parseTextDeck(trimmed)
  if (requirements.length === 0) {
    throw new Error('No se encontraron cartas. Usa líneas como “4 Nombre - Versión” o un CSV con nombre/cantidad o set/número/cantidad.')
  }
  return requirements
}

export function analyzeDeck(
  requirements: DeckRequirement[],
  collection: CollectionCardForDeck[],
): DeckAvailability[] {
  const cardsByName = new Map<string, CollectionCardForDeck[]>()
  const cardsByPrinting = new Map<string, CollectionCardForDeck>()
  collection.forEach((card) => {
    const nameKey = normalizedText(playableName(card))
    cardsByName.set(nameKey, [...(cardsByName.get(nameKey) ?? []), card])
    cardsByPrinting.set(
      `${normalizedText(card.set_code)}:${normalizedCollectorNumber(card.collector_number)}`,
      card,
    )
  })

  const resolved = new Map<string, { requirement: DeckRequirement; cards: CollectionCardForDeck[] }>()
  requirements.forEach((requirement) => {
    const printing = requirement.setCode && requirement.collectorNumber
      ? cardsByPrinting.get(`${normalizedText(requirement.setCode)}:${normalizedCollectorNumber(requirement.collectorNumber)}`)
      : undefined
    const nameKey = printing
      ? normalizedText(playableName(printing))
      : requirement.key.replace(/^name:/, '')
    const cards = cardsByName.get(nameKey) ?? []
    const groupKey = cards.length > 0 ? `card:${nameKey}` : requirement.key
    const previous = resolved.get(groupKey)
    if (previous) {
      previous.requirement.count += requirement.count
    } else {
      resolved.set(groupKey, {
        requirement: { ...requirement },
        cards,
      })
    }
  })

  return Array.from(resolved.entries()).map(([key, { requirement, cards }]) => {
    const reference = cards[0]
    const owned = cards.reduce((total, card) => total + card.quantity, 0)
    return {
      key,
      name: reference?.card_name ?? requirement.name,
      version: reference?.card_version ?? '',
      imageUrl: reference?.image_url ?? null,
      required: requirement.count,
      owned,
      missing: Math.max(requirement.count - owned, 0),
      remaining: Math.max(owned - requirement.count, 0),
      matched: cards.length > 0,
    }
  }).sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'es'))
}
