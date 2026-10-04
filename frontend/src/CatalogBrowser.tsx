import { catalogSlots, EXPECTED_SET_SIZES, type CatalogSlot } from './catalogSlots'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Sparkles } from 'lucide-react'
import { CardViewer, type AddCopy, type OwnershipForCard } from './CardViewer'
import { cardPrice, cardTitle, catalogReprints, isFoilOnlyRarity, loadCatalog, type CatalogCard } from './catalog'
import { CardFilterBar, COMMON_SORT_OPTIONS, CostSymbol } from './CardFilterBar'
import { EMPTY_CARD_FILTERS, filterCards, sortCards, type CardFilterState, type CommonSortMode, type FilterableCard } from './cardFilters'

export function CatalogBrowser({ ownershipForCard, onAddCopy }: { ownershipForCard: OwnershipForCard; onAddCopy: AddCopy }) {
  const [cards, setCards] = useState<CatalogCard[]>([])
  const [filters, setFilters] = useState<CardFilterState>({ ...EMPTY_CARD_FILTERS })
  const [sort, setSort] = useState<CommonSortMode>('set')
  const [availability, setAvailability] = useState<'ALL' | 'PRICED' | 'FOIL' | 'REPRINT'>('ALL')
  const [error, setError] = useState('')
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null)

  useEffect(() => {
    loadCatalog().then(setCards).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar el catálogo.'))
  }, [])

  const slots = useMemo(() => catalogSlots(cards), [cards])
  const pendingCount = slots.filter(card => card.pending && (filters.setCode === 'ALL' || card.set_code === filters.setCode)).length
  const reprints = useMemo(() => catalogReprints(cards), [cards])
  const reprintIds = useMemo(() => new Set(reprints.keys()), [reprints])
  const catalogById = useMemo(() => new Map(slots.map((card) => [card.id, card])), [slots])
  const filterableCards = useMemo(() => slots.map(toFilterableCard), [slots])
  const visible = useMemo(() => sortCards(filterCards(filterableCards, filters).filter((card) => {
    const source = catalogById.get(card.id)
    return source != null && (availability === 'ALL' || (availability === 'PRICED' && cardPrice(source) != null) ||
      (availability === 'FOIL' && source.foil_price_eur != null) || (availability === 'REPRINT' && reprintIds.has(source.id)))
  }), sort).map((card) => catalogById.get(card.id)).filter((card): card is CatalogSlot => card != null), [availability, catalogById, filterableCards, filters, reprintIds, sort])

  return <section className="catalog-page">
    <CardFilterBar cards={filterableCards} filters={filters} onFiltersChange={setFilters} sort={sort} sortOptions={COMMON_SORT_OPTIONS} onSortChange={(value) => setSort(value as CommonSortMode)} resultCount={visible.length} totalCount={slots.length} extraActiveCount={availability === 'ALL' ? 0 : 1} extraActiveLabel={availability === 'PRICED' ? 'Con precio' : availability === 'FOIL' ? 'Con foil' : 'Reimpresas'} onReset={() => setAvailability('ALL')} specificControls={<div className="specific-filter-control"><span>Disponibilidad</span><div>{(['ALL', 'PRICED', 'FOIL', 'REPRINT'] as const).map((value) => <button key={value} className={availability === value ? 'active' : ''} onClick={() => setAvailability(value)}>{value === 'ALL' ? 'Todas' : value === 'PRICED' ? 'Con precio' : value === 'FOIL' ? 'Con foil' : 'Reimpresas'}</button>)}</div></div>} />
    {pendingCount > 0 && <p className="catalog-preview-note">{filters.setCode === '14' ? `${cards.filter(card => card.set_code === '14').length} cartas disponibles de ${EXPECTED_SET_SIZES['14']} previstas. ` : ''}{pendingCount} huecos pendientes en el catálogo, marcados con ?. Se completarán al actualizar las cartas.</p>}
    {error && <p className="notice error">{error}</p>}
    {!error && cards.length === 0 ? <div className="catalog-loading"><Sparkles className="pulse" /><span>Preparando el catálogo completo…</span></div> : visible.length === 0 ? <section className="empty-state catalog-empty"><Search /><h2>No hay cartas con estos filtros</h2><p>Prueba a combinar menos opciones o limpia los filtros activos.</p><button className="primary-command" onClick={() => { setFilters({ ...EMPTY_CARD_FILTERS }); setAvailability('ALL') }}>Mostrar todo el catálogo</button></section> : <div className="catalog-grid">{visible.map((card) => {
      if (card.pending) return <article key={card.id} className="catalog-pending" aria-label={`${card.set_name}, carta ${card.collector_number}, pendiente en el catálogo`}>
        <div className="catalog-pending-image" aria-hidden="true">?<small>#{card.collector_number}</small></div>
        <div><small>{card.set_code} · #{card.collector_number}</small><h2>Pendiente en el catálogo</h2><p>{card.set_name}</p></div>
      </article>
      const otherPrintings = reprints.get(card.id) ?? []
      const price = cardPrice(card)
      return <article key={card.id}><button className="catalog-image" onClick={() => setSelectedCard(card)} aria-label={`Ver ${cardTitle(card)}`}>{card.image_url ? <img src={card.image_url} alt={cardTitle(card)} loading="lazy" /> : <Sparkles />}<span className="catalog-cost"><CostSymbol value={card.cost == null ? '—' : String(card.cost)} /></span>{otherPrintings.length > 0 && <b className="catalog-reprint"><RefreshCw />También en {otherPrintings.map((printing) => printing.set_code).join(', ')}</b>}</button><div><small>{card.set_code} · #{card.collector_number}</small><h2>{card.name}</h2><p>{card.version || card.card_type}</p><footer><span>{card.rarity}</span><span>{price == null ? card.ink || 'Sin tinta' : price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></footer></div></article>
    })}</div>}
    {selectedCard && <CardViewer
      card={toViewerCard(selectedCard)}
      printings={[selectedCard, ...(reprints.get(selectedCard.id) ?? [])].map(toViewerCard)}
      foil={isFoilOnlyRarity(selectedCard.rarity)}
      canToggleFoil={selectedCard.foil_price_eur != null}
      ownershipForCard={ownershipForCard}
      onAddCopy={onAddCopy}
      onClose={() => setSelectedCard(null)}
    />}
  </section>
}

function toFilterableCard(card: CatalogCard): FilterableCard {
  return { id: card.id, name: card.name, version: card.version, setCode: card.set_code, setName: card.set_name, collectorNumber: card.collector_number, ink: card.ink, rarity: card.rarity, cardType: card.card_type, cost: card.cost, priceEur: cardPrice(card), rulesText: card.rules_text }
}

function toViewerCard(card: CatalogCard) {
  return {
    id: card.id,
    name: card.name,
    version: card.version,
    imageUrl: card.image_url,
    setCode: card.set_code,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    ink: card.ink,
    normalPriceEur: card.normal_price_eur,
    foilPriceEur: card.foil_price_eur,
  }
}
