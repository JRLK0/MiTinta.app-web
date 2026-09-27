import { useEffect, useMemo, useRef, useState } from 'react'
import { PackagePlus, X } from 'lucide-react'
import type { CatalogCard } from './catalog'
import { INK_NAMES, resolveStarterDecks, starterDeckTotals, type StarterDeck } from './starterDecks'

const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'Inglés' },
  { code: 'fr', label: 'Francés' },
  { code: 'de', label: 'Alemán' },
  { code: 'it', label: 'Italiano' },
]

export function StarterDeckImporter({ catalog, busy, onClose, onImport }: {
  catalog: CatalogCard[]
  busy: boolean
  onClose: () => void
  onImport: (deck: StarterDeck, language: string) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const decks = useMemo(() => resolveStarterDecks(catalog), [catalog])
  const sets = useMemo(() => [...new Set(decks.map((deck) => deck.setCode))], [decks])
  const [setCode, setSetCode] = useState(sets[0] ?? '')
  const [selectedCode, setSelectedCode] = useState('')
  const [language, setLanguage] = useState('es')
  const [error, setError] = useState('')
  const selected = decks.find((deck) => deck.code === selectedCode)
  const setName = (code: string) => catalog.find((card) => card.set_code === code)?.set_name ?? `Set ${code}`

  useEffect(() => { dialog.current?.showModal() }, [])

  async function submit() {
    if (!selected || busy) return
    setError('')
    try { await onImport(selected, language) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo importar el mazo.') }
  }

  return <dialog ref={dialog} className="starter-import-dialog" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault() }} aria-labelledby="starter-import-title">
    <div className="starter-import-heading">
      <div><span className="starter-import-kicker">Colección</span><h2 id="starter-import-title">Importar mazo comprado</h2><p>Elige el set y el mazo. Se sumarán sus 60 cartas a tu colección.</p></div>
      <button type="button" className="starter-import-close" onClick={() => dialog.current?.close()} disabled={busy} aria-label="Cerrar"><X /></button>
    </div>
    <div className="starter-import-body">
      <div className="starter-import-section-label">Set</div>
      <div className="starter-set-list" role="group" aria-label="Elegir set">{sets.map((code) => <button type="button" key={code} className={setCode === code ? 'active' : ''} onClick={() => { setSetCode(code); setSelectedCode(''); setError('') }} aria-pressed={setCode === code}><b>{code}</b><span>{setName(code)}</span></button>)}</div>
      <div className="starter-import-section-label">Mazo</div>
      <div className="starter-deck-list">{decks.filter((deck) => deck.setCode === setCode).map((deck) => {
        const totals = starterDeckTotals(deck)
        return <button type="button" key={deck.code} className={`starter-deck-option${selectedCode === deck.code ? ' active' : ''}`} onClick={() => { setSelectedCode(deck.code); setError('') }} aria-pressed={selectedCode === deck.code}>
          <span className="starter-deck-name">{deck.name}</span>
          <span className="starter-deck-inks">{deck.colors.map((ink) => <span key={ink}><img src={`${import.meta.env.BASE_URL}ink-icons/${ink.toLowerCase()}.png`} alt="" aria-hidden="true" />{INK_NAMES[ink] ?? ink}</span>)}</span>
          <small>{totals.copies} cartas · {totals.foil} foil</small>
        </button>
      })}</div>
      <div className="starter-import-section-label">Idioma de las cartas</div>
      <div className="starter-language-list" role="group" aria-label="Idioma de las cartas">{LANGUAGES.map((option) => <button type="button" key={option.code} className={language === option.code ? 'active' : ''} onClick={() => setLanguage(option.code)} aria-pressed={language === option.code}>{option.label}</button>)}</div>
      {selected && <section className="starter-import-preview" aria-label="Contenido del mazo">
        <div className="starter-import-preview-head"><strong>{selected.name}</strong><span>{starterDeckTotals(selected).copies} cartas · {starterDeckTotals(selected).foil} foil</span></div>
        {selected.missing.length > 0 ? <p className="notice error">Faltan {selected.missing.length} cartas en el catálogo. Actualiza el catálogo antes de importarlo.</p> : <div className="starter-card-list">{selected.cards.map(({ card, quantity, finish }) => <div key={`${card.set_code}-${card.collector_number}-${finish}`}><b>{quantity}×</b><span>{card.name}{card.version ? ` · ${card.version}` : ''}</span><small>{card.set_code}/{card.collector_number}</small>{finish === 'FOIL' && <em>Foil</em>}</div>)}</div>}
      </section>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
    <div className="starter-import-footer"><span>Las copias existentes se conservarán.</span><button type="button" className="starter-import-submit" onClick={() => void submit()} disabled={!selected || selected.missing.length > 0 || busy}><PackagePlus />{busy ? 'Importando…' : 'Añadir mazo a la colección'}</button></div>
  </dialog>
}
