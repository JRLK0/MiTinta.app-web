import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Copy, Download, Eye, Gem, Search, Sparkles, X } from 'lucide-react'
import type { CollectionEntry } from './App'
import { CardViewer, type AddCopy, type OwnershipForCard, type ViewerCard } from './CardViewer'
import { cardPrice, cardTitle, loadCatalog, type CatalogCard } from './catalog'
import { CARDMARKET_OPTIONAL_RARITIES, cardmarketWantsChunks, cardmarketWantsText, collectionQuantitiesByPrinting, compareCollectorNumbers, filterCardmarketWants, printingKey, safeSetFileName, type CardFinishQuantities, type CardmarketOptionalRarity } from './setCollection'

type SetStatus = 'all' | 'started' | 'complete' | 'missing'
type CardStatus = 'owned' | 'missing' | 'all'

type SetProgress = {
  code: string
  name: string
  cards: CatalogCard[]
  ownedIds: Set<string>
  normalIds: Set<string>
  foilIds: Set<string>
  quantities: Map<string, CardFinishQuantities>
  masterOwned: number
  masterTotal: number
}

const SPECIAL_RARITIES = new Set(['EPIC', 'ENCHANTED', 'ICONIC', 'PROMO'])
const CARDMARKET_RARITY_LABELS: Record<CardmarketOptionalRarity, string> = {
  EPIC: 'Épicas',
  ENCHANTED: 'Encantadas',
  ICONIC: 'Icónicas',
}

function isSpecial(card: CatalogCard) {
  return SPECIAL_RARITIES.has(card.rarity.toLocaleUpperCase('es'))
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function setOrder(code: string) {
  const numeric = Number(code)
  return Number.isFinite(numeric) ? numeric : 10_000
}

export function SetCollectionView({ entries, ownershipForCard, onAddCopy }: { entries: CollectionEntry[]; ownershipForCard: OwnershipForCard; onAddCopy: AddCopy }) {
  const [catalog, setCatalog] = useState<CatalogCard[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<SetStatus>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cardStatus, setCardStatus] = useState<CardStatus>('owned')
  const [exportSetCode, setExportSetCode] = useState<string | null>(null)
  const [exportRarities, setExportRarities] = useState<Set<CardmarketOptionalRarity>>(() => new Set())
  const [copiedList, setCopiedList] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<ViewerCard | null>(null)

  useEffect(() => {
    let active = true
    loadCatalog().then((cards) => {
      if (!active) return
      setCatalog(cards)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { active = false }
  }, [])

  const sets = useMemo(() => {
    const quantities = collectionQuantitiesByPrinting(entries)
    const groups = new Map<string, CatalogCard[]>()
    catalog.forEach((card) => {
      const group = groups.get(card.set_code) ?? []
      group.push(card)
      groups.set(card.set_code, group)
    })
    return Array.from(groups, ([code, cards]): SetProgress => {
      const ownedIds = new Set<string>()
      const normalIds = new Set<string>()
      const foilIds = new Set<string>()
      cards.forEach((card) => {
        const owned = quantities.get(printingKey(card))
        if (owned && owned.total > 0) ownedIds.add(card.id)
        if (owned && owned.normal > 0) normalIds.add(card.id)
        if (owned && owned.foil > 0) foilIds.add(card.id)
      })
      const masterTotal = cards.reduce((sum, card) => sum + (isSpecial(card) ? 1 : 2), 0)
      const masterOwned = cards.reduce((sum, card) => {
        if (isSpecial(card)) return sum + (ownedIds.has(card.id) ? 1 : 0)
        return sum + Number(normalIds.has(card.id)) + Number(foilIds.has(card.id))
      }, 0)
      return { code, name: cards[0]?.set_name ?? code, cards: [...cards].sort(compareCollectorNumbers), ownedIds, normalIds, foilIds, quantities, masterOwned, masterTotal }
    }).sort((a, b) => setOrder(a.code) - setOrder(b.code) || a.code.localeCompare(b.code))
  }, [catalog, entries])

  const visibleSets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return sets.filter((set) => {
      const completion = set.ownedIds.size === set.cards.length
      const started = set.ownedIds.size > 0
      if (status === 'complete' && !completion) return false
      if (status === 'started' && !started) return false
      if (status === 'missing' && completion) return false
      return !normalized || `${set.code} ${set.name}`.toLocaleLowerCase('es').includes(normalized)
    })
  }, [sets, query, status])

  function toggleExportRarity(rarity: CardmarketOptionalRarity) {
    setExportRarities((current) => {
      const next = new Set(current)
      if (next.has(rarity)) next.delete(rarity)
      else next.add(rarity)
      return next
    })
  }

  function downloadCardmarketWants(set: SetProgress, cards: CatalogCard[]) {
    if (!cards.length) return
    const chunks = cardmarketWantsChunks(cards)
    chunks.forEach((chunk, index) => {
      const url = URL.createObjectURL(new Blob([cardmarketWantsText(chunk)], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      const part = chunks.length > 1 ? `-parte-${index + 1}-de-${chunks.length}` : ''
      link.href = url
      link.download = `cardmarket-faltantes-${safeSetFileName(set.name) || set.code}${part}.txt`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    })
  }

  async function copyCardmarketWants(set: SetProgress, cards: CatalogCard[], index: number) {
    if (!cards.length) return
    const text = cardmarketWantsText(cards)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) return
    }
    const key = `${set.code}-${index}`
    setCopiedList(key)
    window.setTimeout(() => setCopiedList((current) => current === key ? null : current), 2200)
  }

  if (loading) return <div className="sets-loading"><Sparkles className="pulse" /><span>Ordenando tus álbumes…</span></div>

  return <section className="sets-view" aria-label="Progreso por sets">
    <header className="sets-toolbar">
      <label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar set" /></label>
      <div role="group" aria-label="Filtrar sets">
        {([['all', 'Todos'], ['started', 'Empezados'], ['missing', 'Con faltantes'], ['complete', 'Completos']] as const).map(([value, label]) =>
          <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>,
        )}
      </div>
    </header>
    <div className="set-ledger">
      {visibleSets.map((set) => {
        const basePercent = percent(set.ownedIds.size, set.cards.length)
        const masterPercent = percent(set.masterOwned, set.masterTotal)
        const missing = set.cards.filter((card) => !set.ownedIds.has(card.id))
        const owned = set.cards.filter((card) => set.ownedIds.has(card.id))
        const displayedCards = cardStatus === 'owned' ? owned : cardStatus === 'missing' ? missing : set.cards
        const missingValue = missing.reduce((sum, card) => sum + (cardPrice(card) ?? 0), 0)
        const cardmarketCards = filterCardmarketWants(missing, exportRarities)
        const cardmarketChunks = cardmarketWantsChunks(cardmarketCards)
        const isExpanded = expanded === set.code
        return <article className={`set-row${isExpanded ? ' expanded' : ''}`} key={set.code}>
          <button className="set-summary" onClick={() => setExpanded(isExpanded ? null : set.code)} aria-expanded={isExpanded}>
            <span className="set-index">{set.code}</span>
            <span className="set-identity"><strong>{set.name}</strong><small>{set.ownedIds.size ? `${set.ownedIds.size} de ${set.cards.length} cartas` : 'Sin empezar'}</small></span>
            <span className="set-progress primary"><i><b style={{ width: `${basePercent}%` }} /></i><span><em>Colección</em><strong>{basePercent}%</strong></span></span>
            <span className="set-progress master"><i><b style={{ width: `${masterPercent}%` }} /></i><span><em>Master set</em><strong>{masterPercent}%</strong></span></span>
            <span className={`set-missing${missing.length === 0 ? ' complete' : ''}`}>{missing.length === 0 ? <><Check />Completo</> : <>{missing.length}<small>faltan</small></>}</span>
            <ChevronDown className="set-chevron" aria-hidden="true" />
          </button>
          {isExpanded && <div className="set-detail">
            <div className="set-variant-stats">
              <span><b>{set.normalIds.size}</b> normales</span><span><Gem /><b>{set.foilIds.size}</b> foil</span><span><Sparkles /><b>{set.cards.filter((card) => isSpecial(card) && set.ownedIds.has(card.id)).length}</b> especiales</span><span><b>{missingValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b> para completar</span>
            </div>
            <div className="set-card-toolbar">
              <div>
                <p className="eyebrow">Álbum de {set.name}</p>
                <h3>{cardStatus === 'owned' ? 'Las que tienes' : cardStatus === 'missing' ? 'Las que te faltan' : 'Todas las cartas'}</h3>
                <span>{displayedCards.length} cartas · ordenadas por número</span>
              </div>
              <div className="set-card-actions">
                <div className="set-card-switch" role="group" aria-label={`Cartas de ${set.name}`}>
                  {([['owned', 'Tengo'], ['missing', 'Me faltan'], ['all', 'Todas']] as const).map(([value, label]) => <button key={value} className={cardStatus === value ? 'active' : ''} onClick={() => setCardStatus(value)}>{value === 'all' && <Eye aria-hidden="true" />}{label}<small>{value === 'owned' ? owned.length : value === 'missing' ? missing.length : set.cards.length}</small></button>)}
                </div>
                <div className="cardmarket-export-wrap">
                  <button className="cardmarket-export" onClick={() => setExportSetCode(exportSetCode === set.code ? null : set.code)} disabled={missing.length === 0} aria-expanded={exportSetCode === set.code} title="Configurar la lista de deseos para Cardmarket"><Download aria-hidden="true" /><span>Cardmarket</span></button>
                  {exportSetCode === set.code && createPortal(<div className="cardmarket-export-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportSetCode(null) }}><div className="cardmarket-export-panel" role="dialog" aria-modal="true" aria-label={`Exportar faltantes de ${set.name} a Cardmarket`}>
                    <header><div><p className="eyebrow">Lista de deseos</p><strong>Exportar a Cardmarket</strong></div><button onClick={() => setExportSetCode(null)} aria-label="Cerrar opciones de exportación"><X /></button></header>
                    <p>Las cartas normales se incluyen siempre. Elige si también quieres buscar estas versiones especiales:</p>
                    <div className="cardmarket-rarity-options">
                      {CARDMARKET_OPTIONAL_RARITIES.map((rarity) => <button key={rarity} role="checkbox" aria-checked={exportRarities.has(rarity)} className={exportRarities.has(rarity) ? 'active' : ''} onClick={() => toggleExportRarity(rarity)}><i>{exportRarities.has(rarity) && <Check />}</i><span>{CARDMARKET_RARITY_LABELS[rarity]}</span><small>{missing.filter((card) => card.rarity.toLocaleUpperCase('en') === rarity).length}</small></button>)}
                    </div>
                    {cardmarketChunks.length > 0 && <div className="cardmarket-copy-lists" aria-label="Copiar listas de Cardmarket">
                      {cardmarketChunks.map((chunk, index) => {
                        const key = `${set.code}-${index}`
                        const copied = copiedList === key
                        return <button key={key} onClick={() => void copyCardmarketWants(set, chunk, index)} className={copied ? 'copied' : ''}><span>{copied ? 'Copiada' : cardmarketChunks.length > 1 ? `Copiar lista ${index + 1}` : 'Copiar lista'}</span><small>{chunk.length} cartas</small>{copied ? <Check /> : <Copy />}</button>
                      })}
                    </div>}
                    <footer><span><b>{cardmarketCards.length}</b> cartas{cardmarketCards.length > 150 ? ` · ${Math.ceil(cardmarketCards.length / 150)} listas` : ''}</span><button onClick={() => downloadCardmarketWants(set, cardmarketCards)} disabled={cardmarketCards.length === 0}><Download />Descargar</button></footer>
                  </div></div>, document.body)}
                </div>
              </div>
            </div>
            {displayedCards.length ? <div className="set-card-grid">
                {displayedCards.map((card) => {
                  const isOwned = set.ownedIds.has(card.id)
                  const quantity = set.quantities.get(printingKey(card)) ?? { normal: 0, foil: 0, total: 0 }
                  return <button className={isOwned ? 'owned' : 'missing'} key={card.id} onClick={() => setSelectedCard({ id: card.id, name: card.name, version: card.version, imageUrl: card.image_url, setCode: card.set_code, setName: card.set_name, collectorNumber: card.collector_number, rarity: card.rarity, ink: card.ink, normalPriceEur: card.normal_price_eur, foilPriceEur: card.foil_price_eur, normalQuantity: quantity.normal, foilQuantity: quantity.foil })} title={`${cardTitle(card)}${isOwned ? ` · ${quantity.total} copias` : ''}`}>
                  {card.image_url ? <img src={card.image_url} alt={cardTitle(card)} loading="lazy" /> : <Sparkles />}
                  <span className="set-card-number">#{card.collector_number}</span>
                  {isOwned && <span className="set-card-owned"><Check aria-hidden="true" />{set.normalIds.has(card.id) && set.foilIds.has(card.id) ? 'Normal + foil' : set.foilIds.has(card.id) ? 'Foil' : 'En colección'}</span>}
                  {isOwned && <span className="set-card-quantity" aria-label={`${quantity.total} copias`}>×{quantity.total}</span>}
                </button>})}
              </div> : <div className="set-complete-note"><Check /><div><strong>{cardStatus === 'missing' ? 'Set base completado' : 'Todavía no tienes cartas de este set'}</strong><span>{cardStatus === 'missing' ? 'Ahora puedes perseguir el master set: normales, foil y acabados especiales.' : 'Cambia a “Todas” para explorar el álbum completo.'}</span></div></div>}
          </div>}
        </article>
      })}
    </div>
    {visibleSets.length === 0 && <div className="sets-empty"><Sparkles /><h2>No hay sets con ese filtro</h2><p>Prueba otra búsqueda o cambia el estado.</p></div>}
    {selectedCard && <CardViewer card={selectedCard} canToggleFoil ownershipForCard={ownershipForCard} onAddCopy={onAddCopy} onClose={() => setSelectedCard(null)} />}
  </section>
}
