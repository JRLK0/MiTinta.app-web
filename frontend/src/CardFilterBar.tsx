import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpDown, BookOpen, ChevronDown, CircleDollarSign, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  activeCardFilterCount, COST_OPTIONS, EMPTY_CARD_FILTERS, INK_OPTIONS, RARITY_OPTIONS, TYPE_OPTIONS,
  toggleFilterValue, type CardFilterState, type CommonSortMode, type FilterableCard,
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
  extraActiveLabel?: string
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

function inkIcon(value: string) {
  return `${import.meta.env.BASE_URL}ink-icons/${value.toLowerCase()}.png`
}

function FilterPopover({ label, value, options, onSelect, searchable = false, icon }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onSelect: (value: string) => void; searchable?: boolean; icon: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [box, setBox] = useState({ top: 0, bottom: 0, left: 0, width: 0, maxHeight: 320, openUp: false })
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label
  const visible = useMemo(() => options.filter((option) => !query || option.label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [options, query])

  function place() {
    const trigger = root.current?.querySelector('button')
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
    const spaceBelow = window.innerHeight - rect.bottom - 16
    const spaceAbove = rect.top - 16
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxHeight = Math.max(180, Math.min(320, openUp ? spaceAbove : spaceBelow))
    setBox({
      top: rect.bottom + 8,
      bottom: window.innerHeight - rect.top + 8,
      left,
      width,
      maxHeight,
      openUp,
    })
  }

  useEffect(() => {
    if (!open) return
    place()
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (root.current?.contains(target)) return
      if ((target as HTMLElement).closest?.('.filter-popover-menu')) return
      setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const menu = open ? createPortal(
    <div
      className="filter-popover-menu"
      style={{
        position: 'fixed',
        top: box.openUp ? 'auto' : box.top,
        bottom: box.openUp ? box.bottom : 'auto',
        left: box.left,
        width: box.width,
        maxHeight: box.maxHeight,
        transformOrigin: box.openUp ? 'bottom left' : 'top left',
      }}
    >
      {searchable && <label className="filter-menu-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar colección" autoFocus /></label>}
      <div className="filter-option-list" role="listbox" aria-label={label} style={{ maxHeight: searchable ? box.maxHeight - 56 : box.maxHeight }}>
        {visible.map((option) => (
          <button key={option.value} className={option.value === value ? 'selected' : ''} role="option" aria-selected={option.value === value} onClick={() => { onSelect(option.value); setOpen(false); setQuery('') }}>
            {option.label}{option.value === value && <i />}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  ) : null

  return <div className={`filter-popover${open ? ' open' : ''}`} ref={root}>
    <span className="filter-field-label">{icon}{label}</span>
    <button className="filter-popover-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="listbox"><span>{selected}</span><ChevronDown /></button>
    {menu}
  </div>
}

export function RaritySymbol({ rarity }: { rarity: string }) {
  const key = rarity.toLocaleLowerCase('en').replaceAll('_', '-')
  const fileName = key === 'super-rare' ? 'super_rare' : key
  return <img className={`rarity-symbol rarity-${key}`} src={`${import.meta.env.BASE_URL}rarity-icons/${fileName}.webp`} alt="" aria-hidden="true" />
}

export function CostSymbol({ value }: { value: string }) {
  return <span className="cost-symbol" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}rarity-icons/inkable.webp`} alt="" /><b>{value}</b></span>
}

function FilterGroups({
  filters,
  patch,
  specificControls,
}: {
  filters: CardFilterState
  patch: (next: Partial<CardFilterState>) => void
  specificControls?: ReactNode
}) {
  return <>
    {specificControls}
    <div className="filter-group-row ink-group">
      <span className="filter-group-title">Tintas</span>
      <div className="filter-chip-scroll">
        <button className={filters.inks.length === 0 ? 'active' : ''} onClick={() => patch({ inks: [] })}>Todas</button>
        {INK_OPTIONS.map((option) => (
          <button key={option.value} className={filters.inks.includes(option.value) ? 'active' : ''} onClick={() => patch({ inks: toggleFilterValue(filters.inks, option.value) })} aria-pressed={filters.inks.includes(option.value)} style={{ '--swatch': option.color } as CSSProperties}>
            <img className="ink-icon" src={inkIcon(option.value)} alt="" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
    <div className="filter-group-row type-group">
      <span className="filter-group-title">Tipos</span>
      <div className="filter-chip-scroll">
        <button className={filters.types.length === 0 ? 'active' : ''} onClick={() => patch({ types: [] })}>Todos</button>
        {TYPE_OPTIONS.map((option) => (
          <button key={option.value} className={filters.types.includes(option.value) ? 'active' : ''} onClick={() => patch({ types: toggleFilterValue(filters.types, option.value) })}>{option.label}</button>
        ))}
      </div>
    </div>
    <div className="filter-icon-groups">
      <div className="filter-group-row cost-group">
        <span className="filter-group-title">Coste</span>
        <div className="cost-filter-scroll">
          {COST_OPTIONS.map((value) => (
            <button key={value} className={filters.costs.includes(value) ? 'active' : ''} onClick={() => patch({ costs: toggleFilterValue(filters.costs, value) })} aria-label={`Coste ${value}`} aria-pressed={filters.costs.includes(value)}>
              <CostSymbol value={value} />
            </button>
          ))}
        </div>
      </div>
      <div className="filter-group-row rarity-group">
        <span className="filter-group-title">Rareza</span>
        <div className="rarity-filter-scroll">
          <button className={filters.rarities.length === 0 ? 'active' : ''} onClick={() => patch({ rarities: [] })}>Todas</button>
          {RARITY_OPTIONS.map((option) => (
            <button key={option.value} aria-pressed={filters.rarities.includes(option.value)} className={filters.rarities.includes(option.value) ? 'active' : ''} onClick={() => patch({ rarities: toggleFilterValue(filters.rarities, option.value) })}>
              <RaritySymbol rarity={option.value} />{option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </>
}

export function CardFilterBar({ cards, filters, onFiltersChange, sort, sortOptions, onSortChange, resultCount, totalCount, specificControls, compact = false, extraActiveCount = 0, extraActiveLabel = 'Filtro adicional', onReset }: CardFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const sets = useMemo(() => Array.from(new Map(cards.map((card) => [card.setCode, card.setName])).entries()).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([code, name]) => ({ value: code, label: `${code} · ${name}` })), [cards])
  const activeCount = activeCardFilterCount(filters) + extraActiveCount
  const patch = (next: Partial<CardFilterState>) => onFiltersChange({ ...filters, ...next })

  useEffect(() => {
    if (!sheetOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const app = document.querySelector<HTMLElement>('.app-shell')
    const wasInert = app?.inert ?? false
    if (app) app.inert = true
    panel.current?.querySelector<HTMLButtonElement>('.filter-sheet-close')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.querySelector('.filter-popover-menu')) return
        setSheetOpen(false)
      }
      if (event.key !== 'Tab') return
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.filter-sheet-panel button, .filter-sheet-panel input, .filter-popover-menu button, .filter-popover-menu input'))
        .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0)
      const first = candidates[0], last = candidates[candidates.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.body.style.overflow = previous
      if (app) app.inert = wasInert
      document.removeEventListener('keydown', keyboard)
      opener.current?.focus()
    }
  }, [sheetOpen])

  const selections = [
    ...(filters.query.trim() ? [{ label: `Búsqueda: ${filters.query}`, clear: () => patch({ query: '' }) }] : []),
    ...(filters.setCode !== 'ALL' ? [{ label: sets.find(set => set.value === filters.setCode)?.label ?? filters.setCode, clear: () => patch({ setCode: 'ALL' }) }] : []),
    ...filters.inks.map(value => ({ label: INK_OPTIONS.find(option => option.value === value)?.label ?? value, clear: () => patch({ inks: toggleFilterValue(filters.inks, value) }) })),
    ...filters.rarities.map(value => ({ label: RARITY_OPTIONS.find(option => option.value === value)?.label ?? value, clear: () => patch({ rarities: toggleFilterValue(filters.rarities, value) }) })),
    ...filters.types.map(value => ({ label: TYPE_OPTIONS.find(option => option.value === value)?.label ?? value, clear: () => patch({ types: toggleFilterValue(filters.types, value) }) })),
    ...filters.costs.map(value => ({ label: `Coste ${value}`, clear: () => patch({ costs: toggleFilterValue(filters.costs, value) }) })),
    ...(filters.price !== 'ALL' ? [{ label: PRICE_OPTIONS.find(option => option.value === filters.price)?.label ?? filters.price, clear: () => patch({ price: 'ALL' }) }] : []),
    ...(extraActiveCount > 0 ? [{ label: extraActiveLabel, clear: () => onReset?.() }] : []),
  ]

  const sheet = sheetOpen ? createPortal(
    <div className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title">
      <button tabIndex={-1} className="filter-sheet-backdrop" aria-label="Cerrar filtros" onClick={() => setSheetOpen(false)} />
      <div className="filter-sheet-panel" ref={panel}>
        <header>
          <h2 id="filter-sheet-title">Filtros</h2>
          <button type="button" className="filter-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Cerrar"><X /></button>
        </header>
        <div className="filter-sheet-body">
          <FilterPopover label="Ordenar" value={sort} options={sortOptions} onSelect={onSortChange} icon={<ArrowUpDown />} />
          <FilterPopover label="Colección" value={filters.setCode} options={[{ value: 'ALL', label: 'Todas las colecciones' }, ...sets]} onSelect={(setCode) => patch({ setCode })} searchable icon={<BookOpen />} />
          <FilterPopover label="Precio" value={filters.price} options={PRICE_OPTIONS} onSelect={(price) => patch({ price: price as CardFilterState['price'] })} icon={<CircleDollarSign />} />
          <FilterGroups filters={filters} patch={patch} specificControls={specificControls} />
        </div>
        <footer>
          {activeCount > 0 && <button type="button" className="filter-reset" onClick={() => { onFiltersChange({ ...EMPTY_CARD_FILTERS }); onReset?.() }}><X />Limpiar <b>{activeCount}</b></button>}
          <button type="button" className="filter-sheet-apply" onClick={() => setSheetOpen(false)}>Ver {resultCount.toLocaleString('es-ES')} cartas</button>
        </footer>
      </div>
    </div>,
    document.body,
  ) : null

  return <section className={`card-filter-bar${compact ? ' compact' : ''}`} aria-label="Filtros de cartas">
    <div className="filter-command-row">
      <label className="filter-search"><span className="sr-only">Buscar cartas</span><Search aria-hidden="true" /><input value={filters.query} onChange={(event) => patch({ query: event.target.value })} placeholder="Nombre, texto, colección o número" /></label>
      <button ref={opener} type="button" aria-haspopup="dialog" className={`filter-sheet-open${activeCount > 0 ? ' active' : ''}`} onClick={() => setSheetOpen(true)}>
        <SlidersHorizontal />Filtros{activeCount > 0 && <b>{activeCount}</b>}
      </button>
      <div className="filter-sort-control">
        <FilterPopover label="Ordenar" value={sort} options={sortOptions} onSelect={onSortChange} icon={<ArrowUpDown />} />
      </div>
      {activeCount > 0 && <button className="filter-reset desktop-only" onClick={() => { onFiltersChange({ ...EMPTY_CARD_FILTERS }); onReset?.() }}><X />Limpiar <b>{activeCount}</b></button>}
    </div>
    {selections.length > 0 && <div className="active-filters" aria-label="Filtros activos">{selections.map((selection, index) => <button key={`${selection.label}-${index}`} onClick={selection.clear} aria-label={`Quitar filtro: ${selection.label}`}>{selection.label}<X aria-hidden="true" /></button>)}</div>}
    <footer className="filter-result-count"><strong>{resultCount.toLocaleString('es-ES')}</strong> de {totalCount.toLocaleString('es-ES')} cartas</footer>
    {sheet}
  </section>
}
