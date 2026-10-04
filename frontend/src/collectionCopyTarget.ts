import { effectiveCardFinish } from './catalog'
import { printingKey } from './setCollection'

type CopyRow = { card_id: string; set_code: string; collector_number: string; language: string; finish: 'NORMAL' | 'FOIL'; rarity: string; quantity: number }
type CardIdentity = { id?: string; setCode?: string; collectorNumber?: string; language?: string }

export function collectionCopyTarget<T extends CopyRow>(rows: T[], card: CardIdentity, finish: 'NORMAL' | 'FOIL', delta: 1 | -1) {
  if (delta === 1) return { card_id: card.id!, language: card.language ?? 'en', finish }
  const key = printingKey({ set_code: card.setCode ?? '', collector_number: card.collectorNumber ?? '' })
  const candidates = rows.filter(row => row.quantity > 0 && printingKey(row) === key && effectiveCardFinish(row.rarity, row.finish) === finish)
  const existing = candidates.find(row => row.language === (card.language ?? 'en')) ?? candidates[0]
  return existing ? { card_id: existing.card_id, language: existing.language, finish: existing.finish } : null
}
