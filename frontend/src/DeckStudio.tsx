import { buildFormatChecker, formatName, replaceDeckPrinting, type DeckFormat } from './deckFormat'
import './deckFormat.css'
import { DeckInkCrest } from './DeckInkCrest'
import { changeDeckCopies, deckCopyState, validateDeck } from './deckRules'
import { ThemeToggle } from '../../shared/ThemeToggle'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  BarChart3, BookOpen, CheckCircle2, ChevronDown, CircleAlert, ClipboardPaste, Download, Eye, EyeOff,
  FileDown, FileUp, Link2, Minus, Plus, Save, Sparkles, Trash2, X,
} from 'lucide-react'
import { cardTitle, loadCatalog, type CatalogCard } from './catalog'
import { CardFilterBar, COMMON_SORT_OPTIONS } from './CardFilterBar'
import { CardViewer, type AddCopy, type OwnershipForCard, type ViewerCard } from './CardViewer'
import { EMPTY_CARD_FILTERS, filterCards, sortCards, type CardFilterState, type CommonSortMode, type FilterableCard } from './cardFilters'
import { parseDeck } from './deckImport'
import { analyzeDeck, type DeckAnalyticsEntry } from './deckAnalytics'
import { buildCardmarketMissingText, buildDeckAvailability, buildDeckPriceSummary, deckAvailabilityKey } from './deckAvailability'
import { deckEditorFingerprint, parseDeckDraft, serializeDeckDraft, type DeckDraftEntry, type DeckEditorState } from './deckDraft'
import { preferredDeckPrinting } from './deckPrintingPreference'
import { supabase } from './supabase'

type OwnedCard = {
  card_id: string
  card_name: string
  card_version: string
  set_code: string
  collector_number: string
  quantity: number
}

type Deck = {
  id: string
  user_id: string
  name: string
  description: string
  is_public: boolean
  updated_at: string
  format: DeckFormat | null
}

type DeckEntry = DeckDraftEntry

function entryFromCard(card: CatalogCard, quantity = 1): DeckEntry {
  return {
    card_id: card.id,
    quantity,
    card_name: card.name,
    card_version: card.version,
    set_code: card.set_code,
    collector_number: card.collector_number,
    image_url: card.image_url,
    ink: card.ink,
    card_type: card.card_type,
    cost: card.cost,
    normal_price_eur: card.normal_price_eur,
    foil_price_eur: card.foil_price_eur,
  }
}

function FormatSelector({ value, onChange }: { value: DeckFormat | null; onChange: (value: DeckFormat) => void }) {
  return <div className="deck-format-selector" role="group" aria-label="Formato del mazo"><span>Construir para</span><div>{(['core', 'infinity'] as const).map(option => <button key={option} aria-pressed={value === option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{formatName(option)}</button>)}</div><small>{value === 'core' ? 'Sets vigentes y reimpresiones válidas' : value === 'infinity' ? 'Todos los sets · con lista de prohibidas' : 'Elige un formato para empezar'}</small></div>
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()
}

function euro(value: number) {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function DeckAnalysis({ entries, publicView = false }: { entries: DeckAnalyticsEntry[]; publicView?: boolean }) {
  const analysis = useMemo(() => analyzeDeck(entries), [entries])
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  return <section className={`deck-analysis${publicView ? ' public' : ''}`} aria-label="Análisis del mazo">
    <div className="curve-panel">
      <div className="analysis-heading"><div><span>Curva de coste</span><strong>{analysis.averageCost.toLocaleString('es-ES', { maximumFractionDigits: 1 })} de media</strong></div><small>{analysis.highCostCards} cartas de coste 6+</small></div>
      <div className="cost-curve">
        {analysis.curve.map((bucket) => <div className="curve-column" key={bucket.label}><b>{bucket.count || ''}</b><i style={{ height: `${Math.max(bucket.count ? 8 : 2, (bucket.count / analysis.maxCurveCount) * 54)}px` }} /><span>{bucket.label}</span></div>)}
      </div>
    </div>
    <div className="type-panel">
      <div className="analysis-heading"><div><span>Composición</span><strong>{total} cartas</strong></div>{analysis.unknownCostCards > 0 && <small>{analysis.unknownCostCards} sin coste</small>}</div>
      <div className="type-breakdown">
        {analysis.types.length > 0 ? analysis.types.map((type) => <div key={type.label}><span>{type.label}</span><i><b style={{ width: `${total ? (type.count / total) * 100 : 0}%` }} /></i><strong>{type.count}</strong></div>) : <p>Añade cartas para ver la composición.</p>}
      </div>
    </div>
  </section>
}

export function DeckStudio({ session, collection, ownershipForCard, onAddCopy }: { session: Session; collection: OwnedCard[]; ownershipForCard: OwnershipForCard; onAddCopy: AddCopy }) {
  const draftKey = `lorcana-deck-draft:${session.user.id}`
  const restoredDraft = useMemo(
    () => parseDeckDraft(window.localStorage.getItem(draftKey), session.user.id),
    [draftKey, session.user.id],
  )
  const [catalog, setCatalog] = useState<CatalogCard[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [decks, setDecks] = useState<Deck[]>([])
  const [activeId, setActiveId] = useState<string | null>(restoredDraft?.activeId ?? null)
  const [name, setName] = useState(restoredDraft?.name ?? 'Mazo nuevo')
  const [description, setDescription] = useState(restoredDraft?.description ?? '')
  const [format, setFormat] = useState<DeckFormat | null>(restoredDraft?.format ?? null)
  const [importFormat, setImportFormat] = useState<DeckFormat | null>(null)
  const [isPublic, setIsPublic] = useState(restoredDraft?.isPublic ?? false)
  const [entries, setEntries] = useState<DeckEntry[]>(restoredDraft?.entries ?? [])
  const [baseline, setBaseline] = useState(() => restoredDraft ? '' : deckEditorFingerprint({ activeId: null, name: 'Mazo nuevo', description: '', isPublic: false, format: null, entries: [] }))
  const [filters, setFilters] = useState<CardFilterState>({ ...EMPTY_CARD_FILTERS })
  const [sort, setSort] = useState<CommonSortMode>('set')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(restoredDraft ? 'Borrador local recuperado.' : '')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [readingClipboard, setReadingClipboard] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<ViewerCard | null>(null)

  const editorState = useMemo<DeckEditorState>(
    () => ({ activeId, name, description, isPublic, format, entries }),
    [activeId, name, description, isPublic, format, entries],
  )
  const editorFingerprint = useMemo(() => deckEditorFingerprint(editorState), [editorState])
  const isDirty = editorFingerprint !== baseline

  useEffect(() => {
    loadCatalog().then(setCatalog).catch((error) => setCatalogError(error instanceof Error ? error.message : 'No se pudo abrir el catálogo.')).finally(() => setLoadingCatalog(false))
    void loadDecks()
  }, [session.user.id])

  useEffect(() => {
    if (!isDirty) {
      window.localStorage.removeItem(draftKey)
      return
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, serializeDeckDraft(session.user.id, editorState))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draftKey, editorState, isDirty, session.user.id])

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [isDirty])

  useEffect(() => {
    if (!importOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImportOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [importOpen])

  function applyEditor(next: DeckEditorState, saved: boolean) {
    setActiveId(next.activeId)
    setName(next.name)
    setDescription(next.description)
    setIsPublic(next.isPublic)
    setFormat(next.format ?? null)
    setEntries(next.entries)
    if (saved) {
      setBaseline(deckEditorFingerprint(next))
      window.localStorage.removeItem(draftKey)
    }
  }

  function canDiscardDraft() {
    return !isDirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')
  }

  async function loadDecks() {
    const { data, error } = await supabase.from('decks').select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false })
    if (error) setMessage(`No se pudieron cargar los mazos: ${error.message}`)
    else setDecks((data ?? []) as Deck[])
  }

  async function openDeck(deck: Deck) {
    if (!canDiscardDraft()) return
    const { data, error } = await supabase.from('deck_entries').select('*').eq('deck_id', deck.id)
    if (error) return setMessage(error.message)
    applyEditor({
      activeId: deck.id,
      name: deck.name,
      description: deck.description,
      isPublic: deck.is_public,
      format: deck.format ?? null,
      entries: (data ?? []) as DeckEntry[],
    }, true)
    setMessage('')
  }

  function newDeck() {
    if (!canDiscardDraft()) return
    applyEditor({ activeId: null, name: 'Mazo nuevo', description: '', isPublic: false, format: null, entries: [] }, true)
    setMessage('')
  }

  function changeCard(card: CatalogCard, delta: number) {
    if (!format) return setMessage('Elige Core o Infinity antes de añadir cartas.')
    const legality = checkFormat(entryFromCard(card))
    if (!legality.legal) setMessage(legality.message)
    setEntries(current => changeDeckCopies(current, entryFromCard(card), delta))
  }

  function changeEntry(cardId: string, delta: number) {
    setEntries(current => {
      const entry = current.find(card => card.card_id === cardId)
      return entry ? changeDeckCopies(current, entry, delta) : current
    })
  }

  async function saveDeck() {
    if (!format) return setMessage('Elige Core o Infinity antes de guardar.')
    if (!name.trim()) return setMessage('Ponle un nombre al mazo.')
    if (validateDeck(entries).tooMany > 0) return setMessage('Reduce las copias que exceden el límite antes de guardar el mazo.')
    setSaving(true)
    setMessage('')
    const deckPayload = { user_id: session.user.id, name: name.trim(), description: description.trim(), is_public: isPublic, format }
    const currentActiveId = activeId
    const result = currentActiveId
      ? await supabase.from('decks').update(deckPayload).eq('id', activeId).select().single()
      : await supabase.from('decks').insert(deckPayload).select().single()
    if (result.error) {
      setSaving(false)
      return setMessage(result.error.message)
    }
    const deck = result.data as Deck
    if (!currentActiveId) setActiveId(deck.id)
    const { error } = await supabase.rpc('replace_deck_entries', {
      target_deck_id: deck.id,
      entries: entries.map(({ deck_id: _deckId, ...entry }) => entry),
    })
    setSaving(false)
    if (error) {
      await loadDecks()
      return setMessage(`El mazo se creó, pero faltó guardar la lista. Reintenta: ${error.message}`)
    }
    const savedState = { ...editorState, activeId: deck.id, name: deck.name, description: deck.description, isPublic: deck.is_public }
    applyEditor(savedState, true)
    setMessage(formatIssues.length ? `Borrador guardado · ${formatIssues.length} cartas pendientes para ${formatName(format)}.` : 'Mazo guardado.')
    await loadDecks()
  }

  async function deleteDeck() {
    if (!activeId || !window.confirm('¿Eliminar este mazo?')) return
    const { error } = await supabase.from('decks').delete().eq('id', activeId)
    if (error) return setMessage(error.message)
    applyEditor({ activeId: null, name: 'Mazo nuevo', description: '', isPublic: false, format: null, entries: [] }, true)
    setMessage('')
    await loadDecks()
  }

  async function copyShareLink() {
    if (!activeId || !isPublic) return
    const url = new URL(window.location.href)
    url.search = `?deck=${activeId}`
    await navigator.clipboard.writeText(url.toString())
    setMessage('Enlace público copiado.')
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (importDeck(await file.text())) setName(file.name.replace(/\.[^.]+$/, '') || 'Mazo importado')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo importar el mazo.')
    }
    event.target.value = ''
  }

  async function pasteFromClipboard() {
    setReadingClipboard(true)
    setImportError('')
    try {
      const content = await navigator.clipboard.readText()
      if (!content.trim()) throw new Error('El portapapeles no contiene una lista de cartas.')
      setImportText(content)
    } catch (error) {
      setImportError(error instanceof Error && error.message ? error.message : 'No se pudo leer el portapapeles. Puedes pegar la lista manualmente en el campo inferior.')
    } finally {
      setReadingClipboard(false)
    }
  }

  function openImporter() {
    setImportFormat(format)
    setImportError('')
    setImportOpen(true)
  }

  function submitImport() {
    setImportError('')
    try {
      importDeck(importText)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo importar el mazo.')
    }
  }

  function importDeck(content: string) {
    if (!importFormat) { setImportError('Elige Core o Infinity para el mazo importado.'); return false }
    if (loadingCatalog || catalogError) { setImportError('Espera a que el catálogo esté disponible antes de importar.'); return false }
    const requirements = parseDeck(content)
    const byPrinting = new Map(catalog.map((card) => [`${normalize(card.set_code)}:${normalize(card.collector_number)}`, card]))
    const cardsByTitle = new Map<string, CatalogCard[]>()
    catalog.forEach((card) => {
      const key = normalize(cardTitle(card))
      cardsByTitle.set(key, [...(cardsByTitle.get(key) ?? []), card])
    })
    const byTitle = new Map(Array.from(cardsByTitle, ([key, cards]) => [key, preferredDeckPrinting(cards)]))
    const resolved = requirements.flatMap((requirement) => {
      const card = requirement.setCode && requirement.collectorNumber
        ? byPrinting.get(`${normalize(requirement.setCode)}:${normalize(requirement.collectorNumber)}`)
        : byTitle.get(normalize(requirement.name))
      return card ? [entryFromCard(card, requirement.count)] : []
    })
    const imported: DeckEntry[] = []
    for (const entry of resolved) {
      const existing = imported.find(candidate => candidate.card_id === entry.card_id)
      if (existing) existing.quantity += entry.quantity
      else imported.push(entry)
    }
    const copyIssues = validateDeck(imported)
    if (copyIssues.tooMany > 0) {
      setImportError(`No se ha importado el mazo. ${copyIssues.issues.filter(issue => issue.includes('copias; máximo')).join(' ')}`)
      return false
    }
    setFormat(importFormat)
    setEntries(imported)
    const importedCheck = buildFormatChecker(catalog, importFormat)
    const invalid = imported.filter(entry => !importedCheck(entry).legal).length
    const reprints = imported.filter(entry => importedCheck(entry).kind === 'reprint').length
    setMessage(`${imported.length} cartas distintas importadas para ${formatName(importFormat)}; ${requirements.length - resolved.length} sin identificar.${invalid ? ` ${invalid} fuera del formato: revisa los avisos de la lista.` : ''}${reprints ? ` ${reprints} con reimpresión válida: puedes cambiar su edición en la lista.` : ''}`)
    setImportText('')
    setImportError('')
    setImportOpen(false)
    return true
  }

  function downloadDeck() {
    const text = entries.map((entry) => `${entry.quantity} ${cardTitle({ name: entry.card_name, version: entry.card_version })}`).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name.trim() || 'mazo'}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function downloadCardmarketMissing() {
    const text = buildCardmarketMissingText(collection, entries)
    if (!text) return
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name.trim() || 'mazo'}-faltantes-cardmarket.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('Lista de faltantes exportada. En Cardmarket, pégala al añadir cartas a una Wants List.')
  }

  const availability = useMemo(() => buildDeckAvailability(collection, entries), [collection, entries])
  const filterableCatalog = useMemo(() => catalog.map(deckFilterCard), [catalog])
  const catalogById = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog])
  const visibleCatalog = useMemo(() => {
    return sortCards(filterCards(filterableCatalog, filters).filter((card) => !onlyAvailable || (availability.get(deckAvailabilityKey(card.name, card.version))?.remaining ?? 0) > 0), sort)
      .map((card) => catalogById.get(card.id))
      .filter((card): card is CatalogCard => card != null)
      .slice(0, 120)
  }, [availability, catalogById, filterableCatalog, filters, onlyAvailable, sort])
  const checkFormat = useMemo(() => buildFormatChecker(catalog, format ?? 'core'), [catalog, format])
  const formatIssues = useMemo(() => format && !loadingCatalog && !catalogError ? entries.filter(entry => !checkFormat(entry).legal) : [], [entries, checkFormat, format, loadingCatalog, catalogError])
  const formatReady = !!format && !loadingCatalog && !catalogError
  const rules = useMemo(() => validateDeck(entries), [entries])
  const missing = Array.from(availability.values()).reduce((sum, card) => sum + card.missing, 0)
  const ownedInDeck = Math.max(0, rules.total - missing)
  const priceSummary = useMemo(() => buildDeckPriceSummary(collection, entries), [collection, entries])

  return (
    <section className="studio-shell deck-workspace">
      <aside className="deck-library">
        <div className="panel-heading"><div><span>Biblioteca</span><h2>Tus mazos</h2></div><button className="new-deck-command" onClick={newDeck}><Plus />Nuevo</button></div>
        <div className="deck-list">
          {decks.map((deck) => <button key={deck.id} className={activeId === deck.id ? 'active' : ''} onClick={() => void openDeck(deck)}><strong>{deck.name}</strong><span>{deck.format && `${formatName(deck.format)} · `}{deck.is_public ? <><Eye /> Público</> : <><EyeOff /> Privado</>}</span></button>)}
          {decks.length === 0 && <p className="panel-empty">Aún no has guardado ningún mazo.</p>}
        </div>
      </aside>

      <div className="deck-editor">
        <div className="deck-editor-head">
          <div className="deck-fields"><input className="deck-title-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} aria-label="Nombre del mazo" /><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Añade una descripción…" aria-label="Descripción del mazo" /><span className={`deck-save-state${isDirty ? ' dirty' : ''}`}>{isDirty ? 'Cambios sin guardar' : 'Guardado'}</span></div>
          <div className="deck-commands">
            <button className="import-command" onClick={openImporter}><FileUp />Importar mazo</button>
            <button className="icon-command" onClick={downloadDeck} disabled={entries.length === 0} title="Exportar mazo" aria-label="Exportar mazo"><Download /></button>
            <button className={`icon-command${isPublic ? ' active' : ''}`} onClick={() => setIsPublic((value) => !value)} title={isPublic ? 'Hacer privado' : 'Hacer público'} aria-label={isPublic ? 'Hacer privado' : 'Hacer público'}>{isPublic ? <Eye /> : <EyeOff />}</button>
            {activeId && isPublic && <button className="icon-command" onClick={() => void copyShareLink()} title="Copiar enlace" aria-label="Copiar enlace"><Link2 /></button>}
            {activeId && <button className="icon-command danger" onClick={() => void deleteDeck()} title="Eliminar mazo" aria-label="Eliminar mazo"><Trash2 /></button>}
            <button className="save-command" onClick={() => void saveDeck()} disabled={saving}><Save />{saving ? 'Guardando' : 'Guardar'}</button>
          </div>
        </div>
        <FormatSelector value={format} onChange={setFormat} />
        {message && <p className="studio-message">{message}<button onClick={() => setMessage('')} aria-label="Cerrar mensaje"><X /></button></p>}
        <div className="deck-overview" aria-label="Estado del mazo">
          <div className="deck-progress-card"><span>Construcción</span><strong>{rules.total}<small>/60</small></strong><div className="deck-progress-track"><i style={{ width: `${Math.min(100, (rules.total / 60) * 100)}%` }} /></div></div>
          <div className={`ownership-summary${missing > 0 ? ' incomplete' : ''}`}>
            <span>{missing > 0 ? 'Colección incompleta' : 'Copias completas'}</span>
            <strong>{ownedInDeck} de {rules.total}</strong>
            <small>{missing > 0 ? `Te faltan ${missing} ${missing === 1 ? 'carta' : 'cartas'}` : 'Tienes todas las copias'}</small>
            {missing > 0 && <button className="cardmarket-export" onClick={downloadCardmarketMissing}><FileDown />Exportar a Cardmarket</button>}
          </div>
          <div className="deck-rule-summary">
            <span className={formatReady && !formatIssues.length ? 'ok' : 'bad'}>{formatReady && !formatIssues.length ? <CheckCircle2 /> : <CircleAlert />}{!format ? 'Elige formato' : !formatReady ? 'Comprobando formato' : formatIssues.length ? `${formatIssues.length} fuera de ${formatName(format)}` : `Cartas válidas en ${formatName(format)}`}</span>
            <span className={rules.inksValid ? 'ok' : 'bad'}><b>{rules.inks.length}{rules.hunnyEnabled ? '' : '/2'}</b> tintas{rules.hunnyEnabled ? ' · Hunny' : ''}</span>
            <span className={rules.tooMany === 0 ? 'ok' : 'bad'}>{rules.tooMany === 0 ? <CheckCircle2 /> : <CircleAlert />}{rules.tooMany === 0 ? 'Copias válidas' : `${rules.tooMany} excesos`}</span>
            <div className="deck-value-summary">
              <span><small>Valor del mazo</small><b>≈ {euro(priceSummary.deckValue)}</b>{priceSummary.deckUnpriced > 0 && <em>+{priceSummary.deckUnpriced} sin precio</em>}</span>
              <span className={missing > 0 ? 'pending' : 'complete'}><small>Valor que te falta</small><b>≈ {euro(priceSummary.missingValue)}</b>{priceSummary.missingUnpriced > 0 && <em>+{priceSummary.missingUnpriced} sin precio</em>}</span>
            </div>
          </div>
          <button className={`analysis-toggle${analysisOpen ? ' open' : ''}`} onClick={() => setAnalysisOpen((value) => !value)} aria-expanded={analysisOpen}><BarChart3 />Análisis<ChevronDown /></button>
        </div>
        {analysisOpen && <DeckAnalysis entries={entries} />}

        <div className="deck-canvas">
          <div className="deck-stack">
            <div className="section-title"><div><h3>Tu lista</h3><span>{entries.length} cartas distintas</span></div><DeckInkCrest inks={rules.inks} baseInks={rules.baseInks} invalid={!rules.inksValid} /></div>
            <div className={`deck-construction-status${rules.valid && formatReady && !formatIssues.length ? '' : ' bad'}`} aria-live="polite"><p>{rules.valid && formatReady && !formatIssues.length ? `Mazo válido para ${formatName(format!)} · 60 cartas o más` : [!format ? 'Elige Core o Infinity.' : '', ...rules.issues, ...(formatIssues.length ? [`${formatIssues.length} ${formatIssues.length === 1 ? 'carta fuera' : 'cartas fuera'} de ${formatName(format!)}. Revisa los avisos de la lista.`] : [])].filter(Boolean).join(' ')}</p>{rules.hunnyEnabled && <p>Christopher Robin: base Amatista/Zafiro; otras tintas solo en personajes Hunny.</p>}</div>
            <div className="deck-card-rows">
              {[...entries].sort((a, b) => (a.cost ?? 99) - (b.cost ?? 99) || a.card_name.localeCompare(b.card_name)).map((entry) => {
                const availabilityKey = deckAvailabilityKey(entry.card_name, entry.card_version)
                const cardAvailability = availability.get(availabilityKey) ?? { owned: 0, required: entry.quantity, remaining: 0, missing: entry.quantity }
                const missingPrice = priceSummary.missingPrices.get(availabilityKey)
                const copyState = deckCopyState(entries, entry)
                const legality = formatReady ? checkFormat(entry) : null
                return <article key={entry.card_id} className={`deck-row${cardAvailability.missing > 0 ? ' is-missing' : ' is-owned'}`}>
                  <button className="deck-preview" onClick={() => { const source = catalog.find((card) => card.id === entry.card_id); setSelectedCard({ id: entry.card_id, name: entry.card_name, version: entry.card_version, imageUrl: entry.image_url, setCode: entry.set_code, setName: source?.set_name, collectorNumber: entry.collector_number, rarity: source?.rarity, ink: entry.ink, normalPriceEur: entry.normal_price_eur, foilPriceEur: entry.foil_price_eur }) }} aria-label={`Ver ${entry.card_name}, ${entry.card_version}`}>{entry.image_url ? <img src={entry.image_url} alt="" /> : <span className="deck-thumb"><Sparkles /></span>}</button>
                  <div><strong>{entry.card_name}</strong><span>{entry.card_version}</span><span className="deck-edition">Set {entry.set_code} · #{entry.collector_number}</span>{legality && legality.kind !== 'legal' && <div className={`deck-format-notice${legality.legal ? ' reprint' : ' invalid'}`}><small>{legality.message}</small>{legality.replacement && <button onClick={() => { const replacement = legality.replacement!; setEntries(current => replaceDeckPrinting(current, entry.card_id, entryFromCard(replacement))); setMessage(`Edición cambiada a ${replacement.set_name}. Se conservan todas las copias.`) }}>Usar {legality.replacement.set_name} · #{legality.replacement.collector_number}</button>}</div>}{copyState.count !== entry.quantity && <small className="deck-shared-copy-limit">{copyState.count}/{Number.isFinite(copyState.limit) ? copyState.limit : '∞'} copias entre todas las ediciones</small>}<small className={cardAvailability.missing === 0 ? 'owned' : 'missing'}>{cardAvailability.missing === 0 ? <><CheckCircle2 />Completa · tienes {cardAvailability.owned}</> : <><CircleAlert />Faltan {cardAvailability.missing} · tienes {cardAvailability.owned} de {cardAvailability.required}</>}</small>{cardAvailability.missing > 0 && <span className="deck-row-price">{missingPrice?.unitPrice == null ? 'Precio aproximado no disponible' : `≈ ${euro(missingPrice.unitPrice)} por carta · ${euro(missingPrice.totalPrice ?? 0)} pendientes`}</span>}</div>
                  <b className="cost-pip">{entry.cost ?? '-'}</b>
                  <div className="mini-stepper"><button onClick={() => changeEntry(entry.card_id, -1)} aria-label={`Quitar una copia de ${entry.card_name}`}><Minus /></button><output title={`${copyState.count} copias entre todas las ediciones`}>{entry.quantity}<small>/{Number.isFinite(copyState.limit) ? copyState.limit : '∞'}</small></output><button disabled={!copyState.canAdd} title={copyState.canAdd ? 'Añadir copia' : `Máximo ${copyState.limit} copias entre todas las ediciones`} onClick={() => changeEntry(entry.card_id, 1)} aria-label={`Añadir una copia de ${entry.card_name}`}><Plus /></button></div>
                </article>
              })}
              {entries.length === 0 && <div className="builder-empty"><BookOpen /><strong>Empieza tu lista</strong><span>Busca cartas en el catálogo o importa un mazo completo.</span><button className="import-command" onClick={openImporter}><FileUp />Importar mazo</button></div>}
            </div>
          </div>

          <div className="catalog-picker">
            <div className="catalog-picker-heading"><div><span>Explorar</span><h3>Añadir cartas</h3></div><p><i className="legend-owned" />En tu colección <i className="legend-missing" />No disponible</p></div>
            <CardFilterBar compact cards={filterableCatalog} filters={filters} onFiltersChange={setFilters} sort={sort} sortOptions={COMMON_SORT_OPTIONS} onSortChange={(value) => setSort(value as CommonSortMode)} resultCount={visibleCatalog.length} totalCount={catalog.length} extraActiveCount={onlyAvailable ? 1 : 0} extraActiveLabel="Solo disponibles" onReset={() => setOnlyAvailable(false)} specificControls={<div className="specific-filter-control"><span>Colección propia</span><div><button className={!onlyAvailable ? 'active' : ''} onClick={() => setOnlyAvailable(false)}>Todas</button><button className={onlyAvailable ? 'active' : ''} onClick={() => setOnlyAvailable(true)}>Solo disponibles</button></div></div>} />
            {catalogError && <p className="notice error">{catalogError}</p>}
            {loadingCatalog ? <p className="picker-loading">Descargando catálogo…</p> : <div className="picker-grid">{visibleCatalog.map((card) => {
              const cardAvailability = availability.get(deckAvailabilityKey(card.name, card.version)) ?? { owned: 0, required: 0, remaining: 0, missing: 0 }
              const copyState = deckCopyState(entries, entryFromCard(card))
              const legality = formatReady ? checkFormat(entryFromCard(card)) : null
              const ownership = cardAvailability.remaining > 0 ? 'available' : cardAvailability.owned > 0 ? 'used' : 'unowned'
              return <article key={card.id} className={`picker-card ownership-${ownership}`}><div className={`ownership-badge ${ownership}`}>{ownership === 'available' ? <><CheckCircle2 />Tienes {cardAvailability.remaining} disponible{cardAvailability.remaining === 1 ? '' : 's'}</> : ownership === 'used' ? 'Copias ya usadas' : 'No la tienes'}</div><button className="picker-preview" onClick={() => setSelectedCard({ id: card.id, name: card.name, version: card.version, imageUrl: card.image_url, setCode: card.set_code, setName: card.set_name, collectorNumber: card.collector_number, rarity: card.rarity, ink: card.ink, normalPriceEur: card.normal_price_eur, foilPriceEur: card.foil_price_eur })} aria-label={`Ver ${cardTitle(card)}`}>{card.image_url ? <img src={card.image_url} alt={cardTitle(card)} loading="lazy" /> : <span className="deck-thumb"><Sparkles /></span>}</button><button disabled={!copyState.canAdd} onClick={() => changeCard(card, 1)} title={copyState.canAdd ? `Añadir ${cardTitle(card)}` : `Máximo ${copyState.limit} copias entre todas las ediciones`} aria-label={`Añadir ${cardTitle(card)}`}><Plus /></button><div><strong>{card.name}</strong><span>{card.version}</span>{legality && !legality.legal && <small className="picker-format-warning" title={legality.message}>{legality.kind === 'banned' ? 'Prohibida' : legality.kind === 'unreleased' ? 'Pendiente de lanzamiento' : `Fuera de ${formatName(format!)}`}</small>}<small className={`deck-copy-count${!copyState.canAdd ? ' at-limit' : ''}`}>{copyState.count}/{Number.isFinite(copyState.limit) ? copyState.limit : '∞'} en el mazo{!copyState.canAdd ? ' · Máximo' : ''}</small></div></article>
            })}</div>}
          </div>
        </div>
      </div>
      {importOpen && <div className="deck-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false) }}><section className="deck-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><header><div className="modal-icon"><FileUp /></div><div><p className="eyebrow">Añadir una lista</p><h2 id="import-title">Importar mazo</h2></div><button className="modal-close" onClick={() => setImportOpen(false)} aria-label="Cerrar importación"><X /></button></header><p className="import-intro">Pega una lista desde Dreamborn, InkDecks u otra web. También puedes subir un archivo <b>.txt</b> o <b>.csv</b>.</p><FormatSelector value={importFormat} onChange={setImportFormat} /><div className="import-source-actions"><button onClick={() => void pasteFromClipboard()} disabled={readingClipboard}><ClipboardPaste />{readingClipboard ? 'Leyendo…' : 'Pegar del portapapeles'}</button><label><FileUp />Elegir archivo<input type="file" accept=".txt,.csv" onChange={(event) => void importFile(event)} hidden /></label></div><label className="import-text-label"><span>Lista de cartas</span><small>Formato: cantidad + nombre de la carta</small><textarea autoFocus value={importText} onChange={(event) => { setImportText(event.target.value); setImportError('') }} placeholder={'4 Mickey Mouse - Brave Little Tailor\n4 Lumpy - Hunny Druid'} aria-label="Lista para importar" /></label>{importError && <p className="import-error" role="alert"><CircleAlert />{importError}</p>}<div className="import-example"><strong>Ejemplo compatible</strong><code>4 Mickey Mouse - Brave Little Tailor</code></div><footer><span>Al importar, se reemplazará la lista actual.</span><div><button className="cancel-command" onClick={() => setImportOpen(false)}>Cancelar</button><button className="save-command" onClick={submitImport} disabled={!importText.trim() || !importFormat || loadingCatalog || !!catalogError}><FileUp />Importar lista</button></div></footer></section></div>}
      {selectedCard && <CardViewer card={selectedCard} canToggleFoil={selectedCard.foilPriceEur != null} ownershipForCard={ownershipForCard} onAddCopy={onAddCopy} onClose={() => setSelectedCard(null)} />}
    </section>
  )
}

function deckFilterCard(card: CatalogCard): FilterableCard {
  return { id: card.id, name: card.name, version: card.version, setCode: card.set_code, setName: card.set_name, collectorNumber: card.collector_number, ink: card.ink, rarity: card.rarity, cardType: card.card_type, cost: card.cost, priceEur: card.normal_price_eur, rulesText: card.rules_text }
}

export function PublicDeck({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [entries, setEntries] = useState<DeckEntry[]>([])
  const [error, setError] = useState('')
  const [selectedCard, setSelectedCard] = useState<ViewerCard | null>(null)

  useEffect(() => {
    supabase.rpc('get_public_deck', { target_deck_id: deckId }).then(({ data, error }) => {
      if (error || !data?.deck) setError('Este mazo no existe o es privado.')
      else { setDeck(data.deck as Deck); setEntries((data.entries ?? []) as DeckEntry[]) }
    })
  }, [deckId])

  function exportText() {
    const text = entries.map((entry) => `${entry.quantity} ${cardTitle({ name: entry.card_name, version: entry.card_version })}`).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${deck?.name ?? 'mazo'}.txt`; anchor.click(); URL.revokeObjectURL(url)
  }

  if (error) return <main className="public-deck-state"><CircleAlert /><h1>{error}</h1><a href={import.meta.env.BASE_URL}>Volver a Lorcana Lector</a></main>
  if (!deck) return <main className="public-deck-state"><Sparkles className="pulse" /><span>Abriendo mazo</span></main>
  const rules = validateDeck(entries)
  const deckValue = entries.reduce((sum, entry) => sum + (entry.normal_price_eur ?? 0) * entry.quantity, 0)
  return <main className="public-deck-page"><header><a href={import.meta.env.BASE_URL}><img src={`${import.meta.env.BASE_URL}ink-icons/amethyst.png`} alt="" width="25" height="25" />MiTinta</a><div className="header-actions"><ThemeToggle /><button className="save-command" onClick={exportText}><Download />Descargar</button></div></header><section className="public-deck-hero"><div><p className="eyebrow">Mazo compartido{deck.format ? ` · ${formatName(deck.format)}` : ' · Formato sin especificar'}</p><h1>{deck.name}</h1><p>{deck.description}</p></div><div className="public-deck-stats"><span><b>{rules.total}</b> cartas</span><span><b>{entries.length}</b> distintas</span><span><b>{rules.inks.length}</b> tintas</span><span><b>{deckValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b> valor</span></div></section><DeckAnalysis entries={entries} publicView /><section className="public-card-grid">{entries.map((entry) => <article key={entry.card_id}><button className="public-card-preview" onClick={() => setSelectedCard({ name: entry.card_name, version: entry.card_version, imageUrl: entry.image_url, setCode: entry.set_code, collectorNumber: entry.collector_number, ink: entry.ink, normalPriceEur: entry.normal_price_eur, foilPriceEur: entry.foil_price_eur })} aria-label={`Ver ${entry.card_name}, ${entry.card_version}`}>{entry.image_url && <img src={entry.image_url} alt={cardTitle({ name: entry.card_name, version: entry.card_version })} />}</button><b>{entry.quantity}x</b><div><strong>{entry.card_name}</strong><span>{entry.card_version}</span></div></article>)}</section>{selectedCard && <CardViewer card={selectedCard} canToggleFoil={selectedCard.foilPriceEur != null} onClose={() => setSelectedCard(null)} />}</main>
}
