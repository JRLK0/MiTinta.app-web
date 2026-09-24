import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, BookOpen, ChevronDown, CircleDollarSign, Search, X } from 'lucide-react'
import {
  activeCardFilterCount, COST_OPTIONS, EMPTY_CARD_FILTERS, INK_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS,
  toggleFilterValue, type CardFilterState, type CommonSortMode, type CostFilter, type FilterableCard,
} from './cardFilters'

export type SortOption = { value: string; label: string }

type CardFilterBarProps = {
  cards: FilterableCard[]
  filters: CardFilterState
  onFiltersChange: (filters: CardFilterState) => void
  sort: string
  sortOptions: SortOption[]
  onSortChange: (sort: string) => void
  resultCount: number
  totalCount: number
  specificControls?: ReactNode
  compact?: boolean
  extraActiveCount?: number
  onReset?: () => void
}

const PRICE_OPTIONS = [
  { value: 'ALL', label: 'Cualquier precio' }, { value: '<1', label: 'Menos de 1 €' },
  { value: '1-5', label: 'De 1 a 5 €' }, { value: '5-20', label: 'De 5 a 20 €' },
  { value: '20+', label: '20 € o más' }, { value: 'NONE', label: 'Sin precio' },
]

export const COMMON_SORT_OPTIONS: Array<{ value: CommonSortMode; label: string }> = [
  { value: 'set', label: 'Colección y número' }, { value: 'name-asc', label: 'Nombre A–Z' },
  { value: 'name-desc', label: 'Nombre Z–A' }, { value: 'cost-asc', label: 'Coste: menor primero' },
  { value: 'cost-desc', label: 'Coste: mayor primero' }, { value: 'price-asc', label: 'Precio: menor primero' },
  { value: 'price-desc', label: 'Precio: mayor primero' }, { value: 'rarity', label: 'Rareza' },
]

function FilterPopover({ label, value, options, onSelect, searchable = false, icon }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onSelect: (value: string) => void; searchable?: boolean; icon: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label
  const visible = useMemo(() => options.filter((option) => !query || option.label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [options, query])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  return <div className={`filter-popover${open ? ' open' : ''}`} ref={root}>
    <span className="filter-field-label">{icon}{label}</span>
    <button className="filter-popover-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="listbox"><span>{selected}</span><ChevronDown /></button>
    {open && <div className="filter-popover-menu">
      {searchable && <label className="filter-menu-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar colección" autoFocus /></label>}
      <div className="filter-option-list" role="listbox" aria-label={label}>{visible.map((option) => <button key={option.value} className={option.value === value ? 'selected' : ''} role="option" aria-selected={option.value === value} onClick={() => { onSelect(option.value); setOpen(false); setQuery('') }}>{option.label}{option.value === value && <i />}</button>)}</div>
    </div>}
  </div>
}

export function RaritySymbol({ rarity }: { rarity: string }) {
  const key = rarity.toLocaleLowerCase('en').replaceAll('_', '-')
  const fileName = key === 'super-rare' ? 'super_rare' : key
  return <img className={`rarity-symbol rarity-${key}`} src={`${import.meta.env.BASE_URL}rarity-icons/${fileName}.webp`} alt="" aria-hidden="true" />
}

function CostSymbol({ value }: { value: CostFilter }) {
  return <span className="cost-symbol" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}rarity-icons/inkable.webp`} alt="" /><b>{value}</b></span>
}

export function CardFilterBar({ cards, filters, onFiltersChange, sort, sortOptions, onSortChange, resultCount, totalCount, specificControls, compact = false, extraActiveCount = 0, onReset }: CardFilterBarProps) {
  const sets = useMemo(() => Array.from(new Map(cards.map((card) => [card.setCode, card.setName])).entries()).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([code, name]) => ({ value: code, label: `${code} · ${name}` })), [cards])
  const activeCount = activeCardFilterCount(filters) + extraActiveCount
  const patch = (next: Partial<CardFilterState>) => onFiltersChange({ ...filters, ...next })

  return <section className={`card-filter-bar${compact ? ' compact' : ''}`} aria-label="Filtros de cartas">
    <div className="filter-command-row">
      <label className="filter-search"><Search /><input value={filters.query} onChange={(event) => patch({ query: event.target.value })} placeholder="Nombre, texto, colección o número" /></label>
      <FilterPopover label="Ordenar" value={sort} options={sortOptions} onSelect={onSortChange} icon={<ArrowUpDown />} />
      {activeCount > 0 && <button className="filter-reset" onClick={() => { onFiltersChange({ ...EMPTY_CARD_FILTERS }); onReset?.() }}><X />Limpiar <b>{activeCount}</b></button>}
    </div>
    <div className="filter-select-row">
      <FilterPopover label="Colección" value={filters.setCode} options={[{ value: 'ALL', label: 'Todas las colecciones' }, ...sets]} onSelect={(setCode) => patch({ setCode })} searchable icon={<BookOpen />} />
      <FilterPopover label="Precio" value={filters.price} options={PRICE_OPTIONS} onSelect={(price) => patch({ price: price as CardFilterState['price'] })} icon={<CircleDollarSign />} />
      {specificControls}
    </div>
    <div className="filter-group-row ink-group"><span className="filter-group-title">Tintas</span><div className="filter-chip-scroll"><button className={filters.inks.length === 0 ? 'active' : ''} onClick={() => patch({ inks: [] })}>Todas</button>{INK_OPTIONS.map((option) => <button key={option.value} className={filters.inks.includes(option.value) ? 'active' : ''} onClick={() => patch({ inks: toggleFilterValue(filters.inks, option.value) })} style={{ '--swatch': option.color } as CSSProperties}><i className="ink-swatch" />{option.label}</button>)}</div></div>
    <div className="filter-group-row type-group"><span className="filter-group-title">Tipos</span><div className="filter-chip-scroll"><button className={filters.types.length === 0 ? 'active' : ''} onClick={() => patch({ types: [] })}>Todos</button>{TYPE_OPTIONS.map((option) => <button key={option.value} className={filters.types.includes(option.value) ? 'active' : ''} onClick={() => patch({ types: toggleFilterValue(filters.types, option.value) })}>{option.label}</button>)}</div></div>
    <div className="filter-icon-groups">
      <div className="filter-group-row cost-group"><span className="filter-group-title">Coste</span><div className="cost-filter-scroll">{COST_OPTIONS.map((value) => <button key={value} className={filters.costs.includes(value) ? 'active' : ''} onClick={() => patch({ costs: toggleFilterValue(filters.costs, value) })} aria-label={`Coste ${value}`} aria-pressed={filters.costs.includes(value)}><CostSymbol value={value} /></button>)}</div></div>
      <div className="filter-group-row rarity-group"><span className="filter-group-title">Rareza</span><div className="rarity-filter-scroll"><button className={filters.rarities.length === 0 ? 'active' : ''} onClick={() => patch({ rarities: [] })}>Todas</button>{RARITY_OPTIONS.map((option) => <button key={option.value} className={filters.rarities.includes(option.value) ? 'active' : ''} onClick={() => patch({ rarities: toggleFilterValue(filters.rarities, option.value) })}><RaritySymbol rarity={option.value} />{option.label}</button>)}</div></div>
    </div>
    <footer className="filter-result-count"><strong>{resultCount.toLocaleString('es-ES')}</strong> de {totalCount.toLocaleString('es-ES')} cartas</footer>
  </section>
}
