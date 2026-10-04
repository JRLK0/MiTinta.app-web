export type DeckDraftEntry = {
  deck_id?: string
  card_id: string
  quantity: number
  card_name: string
  card_version: string
  set_code: string
  collector_number: string
  image_url: string | null
  ink: string | null
  card_type: string
  cost: number | null
  normal_price_eur: number | null
  foil_price_eur: number | null
}

export type DeckEditorState = {
  activeId: string | null
  name: string
  description: string
  isPublic: boolean
  entries: DeckDraftEntry[]
}

export type DeckDraft = DeckEditorState & {
  version: 1
  userId: string
  updatedAt: string
}

export function deckEditorFingerprint(state: DeckEditorState) {
  return JSON.stringify({
    ...state,
    entries: [...state.entries].sort((left, right) => left.card_id.localeCompare(right.card_id)),
  })
}

export function serializeDeckDraft(userId: string, state: DeckEditorState, updatedAt = new Date().toISOString()) {
  return JSON.stringify({ version: 1, userId, updatedAt, ...state } satisfies DeckDraft)
}

export function parseDeckDraft(value: string | null, expectedUserId: string): DeckDraft | null {
  if (!value) return null
  try {
    const draft = JSON.parse(value) as Partial<DeckDraft>
    if (
      draft.version !== 1 || draft.userId !== expectedUserId ||
      typeof draft.name !== 'string' || typeof draft.description !== 'string' ||
      typeof draft.isPublic !== 'boolean' || !Array.isArray(draft.entries) ||
      typeof draft.updatedAt !== 'string' ||
      !(draft.activeId === null || typeof draft.activeId === 'string') ||
      draft.entries.some((entry) => (
        !entry || typeof entry.card_id !== 'string' || typeof entry.card_name !== 'string' ||
        !Number.isSafeInteger(entry.quantity) || entry.quantity < 1
      ))
    ) return null
    return draft as DeckDraft
  } catch {
    return null
  }
}
