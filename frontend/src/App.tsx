import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CircleUserRound,
  Cloud,
  Download,
  Layers3,
  LibraryBig,
  ListChecks,
  PackagePlus,
  Rows3,
  LogOut,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { isConfigured, supabase } from './supabase'
import { CatalogBrowser } from './CatalogBrowser'
import { CardFilterBar, COMMON_SORT_OPTIONS } from './CardFilterBar'
import { CardViewer } from './CardViewer'
import { cardPrice, effectiveCardFinish, loadCatalog, type CatalogCard } from './catalog'
import { collectionCardForFilters, EMPTY_CARD_FILTERS, filterCards, sortCards, type CardFilterState, type CommonSortMode } from './cardFilters'
import { DeckStudio, PublicDeck } from './DeckStudio'
import { playValuableCardSound, prepareValuableCardSound, valuableCardSoundFor } from './valuableCardSound'
import { parsePriceHistory, priceTrendFor, updatePriceHistory, type PriceHistory } from './priceHistory'
import { loadAllPages } from './pagination'
import { SetCollectionView } from './SetCollectionView'
import { StarterDeckImporter } from './StarterDeckImporter'
import { starterDeckTotals, type StarterDeck } from './starterDecks'

export type CollectionEntry = {
  user_id: string
  card_id: string
  language: string
  finish: 'NORMAL' | 'FOIL'
  quantity: number
  card_name: string
  card_version: string
  set_code: string
  set_name: string
  collector_number: string
  image_url: string | null
  ink: string | null
  rarity: string
  normal_price_eur: number | null
  foil_price_eur: number | null
  updated_at: string
}

type FinishFilter = 'ALL' | 'NORMAL' | 'FOIL'
type CollectionSortMode = CommonSortMode | 'recent' | 'quantity'
type CollectionView = 'collection' | 'catalog' | 'decks'
type CollectionMode = 'cards' | 'sets'

const CARD_SIZE_MIN = 135
const CARD_SIZE_MAX = 280
const CARD_SIZE_STEP = 10
const COLLECTION_SORT_OPTIONS = [
  { value: 'recent', label: 'Últimas añadidas' },
  { value: 'quantity', label: 'Cantidad' },
  ...COMMON_SORT_OPTIONS,
]

function collectionEntryKey(entry: Pick<CollectionEntry, 'card_id' | 'language' | 'finish'>) {
  return `${entry.card_id}-${entry.language}-${entry.finish}`
}

function csvCell(value: string | number) {
  const text = String(value)
  return text.includes(',') || text.includes('"') || text.includes('\n')
    ? `"${text.replaceAll('"', '""')}"`
    : text
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      else if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      setSession(nextSession)
      setCheckingSession(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sharedDeckId = new URLSearchParams(window.location.search).get('deck')
  if (sharedDeckId) return <PublicDeck deckId={sharedDeckId} />
  if (checkingSession) return <LoadingScreen />
  if (passwordRecovery) return <PasswordRecoveryScreen onComplete={() => setPasswordRecovery(false)} />
  if (!session) return <AuthScreen />
  return <CollectionDashboard session={session} />
}

function LoadingScreen() {
  return (
    <main className="center-screen" aria-live="polite">
      <Cloud className="pulse" aria-hidden="true" />
      <span>Abriendo tu colección</span>
    </main>
  )
}

function AuthScreen() {
  const [createAccount, setCreateAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsSuccess, setMessageIsSuccess] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setMessageIsSuccess(false)
    const result = createAccount
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
        })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else if (createAccount && !result.data.session) {
      setMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.')
      setMessageIsSuccess(true)
    }
  }

  async function requestPasswordReset() {
    if (!email.trim()) {
      setMessage('Introduce primero el correo de tu cuenta.')
      setMessageIsSuccess(false)
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    })
    setBusy(false)
    setMessage(error ? error.message : 'Te hemos enviado un enlace para cambiar la contraseña.')
    setMessageIsSuccess(!error)
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-lockup">
          <span className="brand-mark"><Sparkles aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Archivo personal</p>
            <h1 id="auth-title">Lorcana Lector</h1>
          </div>
        </div>
        <p className="auth-intro">Tu colección del móvil, disponible aquí en cuanto escaneas una carta.</p>
        {!isConfigured && (
          <p className="notice error">Falta configurar la conexión pública con Supabase.</p>
        )}
        <div className="segmented" aria-label="Modo de acceso">
          <button type="button" className={!createAccount ? 'active' : ''} onClick={() => setCreateAccount(false)}>Entrar</button>
          <button type="button" className={createAccount ? 'active' : ''} onClick={() => setCreateAccount(true)}>Crear cuenta</button>
        </div>
        <form onSubmit={submit}>
          <label>
            Correo electrónico
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={createAccount ? 'new-password' : 'current-password'} minLength={6} required />
          </label>
          {message && <p className={messageIsSuccess ? 'notice success' : 'notice error'}>{message}</p>}
          <button className="primary-command" disabled={busy || !isConfigured}>
            {busy ? 'Conectando…' : createAccount ? 'Crear mi cuenta' : 'Entrar en mi colección'}
          </button>
          {!createAccount && <button type="button" className="text-command" onClick={() => void requestPasswordReset()} disabled={busy || !isConfigured}>He olvidado mi contraseña</button>}
        </form>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <div className="edition-stamp">CATÁLOGO<br />PERSONAL<br /><b>2026</b></div>
        <p>Escanea en Android.<br />Ordena aquí.</p>
      </aside>
    </main>
  )
}

function PasswordRecoveryScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function updatePassword(event: FormEvent) {
    event.preventDefault()
    if (password.length < 6) return setMessage('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirmation) return setMessage('Las contraseñas no coinciden.')
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMessage(error.message)
    else onComplete()
  }

  return <main className="recovery-shell">
    <section className="recovery-panel" aria-labelledby="recovery-title">
      <div className="brand-lockup"><span className="brand-mark"><Sparkles aria-hidden="true" /></span><div><p className="eyebrow">Cuenta personal</p><h1 id="recovery-title">Nueva contraseña</h1></div></div>
      <form onSubmit={updatePassword}>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
        <label>Confirmar contraseña<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} required /></label>
        {message && <p className="notice error">{message}</p>}
        <button className="primary-command" disabled={busy}>{busy ? 'Actualizando…' : 'Guardar contraseña'}</button>
        <button type="button" className="text-command" onClick={() => void supabase.auth.signOut()}>Cancelar y cerrar sesión</button>
      </form>
    </section>
  </main>
}

function CollectionDashboard({ session }: { session: Session }) {
  const [entries, setEntries] = useState<CollectionEntry[]>([])
  const [catalogMetadata, setCatalogMetadata] = useState<CatalogCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<CardFilterState>({ ...EMPTY_CARD_FILTERS })
  const [finish, setFinish] = useState<FinishFilter>('ALL')
  const [sort, setSort] = useState<CollectionSortMode>('recent')
  const [activeView, setActiveView] = useState<CollectionView>('collection')
  const [collectionMode, setCollectionMode] = useState<CollectionMode>('cards')
  const [starterImporterOpen, setStarterImporterOpen] = useState(false)
  const [starterImportBusy, setStarterImportBusy] = useState(false)
  const [starterImportMessage, setStarterImportMessage] = useState('')
  const [cardSize, setCardSize] = useState(() => {
    const saved = Number(window.localStorage.getItem('lorcana-card-size'))
    return Number.isFinite(saved) && saved >= CARD_SIZE_MIN && saved <= CARD_SIZE_MAX ? saved : 170
  })
  const [newEntryKeys, setNewEntryKeys] = useState<Set<string>>(() => new Set())
  const [selectedEntry, setSelectedEntry] = useState<CollectionEntry | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('lorcana-valuable-sound') !== 'off')
  const priceHistoryKey = `lorcana-price-history:${session.user.id}`
  const [priceHistory, setPriceHistory] = useState<PriceHistory>(() => parsePriceHistory(window.localStorage.getItem(priceHistoryKey)))
  const [arrivalCelebration, setArrivalCelebration] = useState<{ entry: CollectionEntry; jackpot: boolean; nonce: number } | null>(null)
  const entriesRef = useRef<CollectionEntry[]>([])
  const soundEnabledRef = useRef(soundEnabled)
  const arrivalTimers = useRef<Map<string, number>>(new Map())
  const localQuantityUpdates = useRef<Map<string, number>>(new Map())
  const starterImportInFlight = useRef(false)
  const collectionRequestId = useRef(0)

  useEffect(() => {
    loadCatalog().then(setCatalogMetadata).catch(() => undefined)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('lorcana-card-size', String(cardSize))
  }, [cardSize])

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
    window.localStorage.setItem('lorcana-valuable-sound', soundEnabled ? 'on' : 'off')
    if (!soundEnabled) return
    const unlockAudio = () => { void prepareValuableCardSound() }
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [soundEnabled])

  useEffect(() => {
    if (!arrivalCelebration) return
    const timer = window.setTimeout(() => setArrivalCelebration(null), arrivalCelebration.jackpot ? 3200 : 2200)
    return () => window.clearTimeout(timer)
  }, [arrivalCelebration])

  async function loadCollection() {
    const requestId = ++collectionRequestId.current
    const { data, error: requestError } = await loadAllPages<CollectionEntry>(async (from, to) => {
      const { data: page, error } = await supabase
        .from('collection_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .gt('quantity', 0)
        .order('updated_at', { ascending: false })
        .order('card_id', { ascending: true })
        .order('language', { ascending: true })
        .order('finish', { ascending: true })
        .range(from, to)
      return { data: page as CollectionEntry[] | null, error }
    })
    if (requestId !== collectionRequestId.current) return
    if (requestError) setError(requestError.message)
    else {
      const nextEntries = (data ?? []) as CollectionEntry[]
      setPriceHistory((current) => {
        const next = updatePriceHistory(current, nextEntries.map((entry) => ({
          key: collectionEntryKey(entry),
          price: cardPrice(entry, entry.finish),
        })))
        window.localStorage.setItem(priceHistoryKey, JSON.stringify(next))
        return next
      })
      entriesRef.current = nextEntries
      setEntries(nextEntries)
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadCollection()
    const channel = supabase
      .channel(`collection:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collection_entries', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const incoming = payload.new as CollectionEntry
          if (incoming?.card_id && incoming.quantity > 0) {
            const key = collectionEntryKey(incoming)
            const previous = entriesRef.current.find((entry) => collectionEntryKey(entry) === key)
            const isLocalUpdate = localQuantityUpdates.current.get(key) === incoming.quantity
            if (isLocalUpdate) localQuantityUpdates.current.delete(key)
            if (!previous || incoming.quantity > previous.quantity) {
              const price = cardPrice(incoming, incoming.finish)
              const arrivalSound = valuableCardSoundFor(price)
              if (!isLocalUpdate && soundEnabledRef.current && arrivalSound !== 'none') void playValuableCardSound(arrivalSound)
              if (!isLocalUpdate && arrivalSound !== 'none') {
                setArrivalCelebration({ entry: incoming, jackpot: arrivalSound === 'jackpot', nonce: Date.now() })
              }
              const currentTimer = arrivalTimers.current.get(key)
              if (currentTimer) window.clearTimeout(currentTimer)
              setNewEntryKeys((current) => new Set(current).add(key))
              const timer = window.setTimeout(() => {
                setNewEntryKeys((current) => {
                  const next = new Set(current)
                  next.delete(key)
                  return next
                })
                arrivalTimers.current.delete(key)
              }, 2800)
              arrivalTimers.current.set(key, timer)
            }
          }
          void loadCollection()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      arrivalTimers.current.forEach((timer) => window.clearTimeout(timer))
      arrivalTimers.current.clear()
    }
  }, [session.user.id])

  const catalogById = useMemo(() => new Map(catalogMetadata.map((card) => [card.id, card])), [catalogMetadata])
  const collectionFilterCards = useMemo(() => entries.map((entry) => collectionCardForFilters(entry, catalogById.get(entry.card_id))), [catalogById, entries])
  const entryByKey = useMemo(() => new Map(entries.map((entry) => [collectionEntryKey(entry), entry])), [entries])
  const visibleEntries = useMemo(() => {
    const filtered = filterCards(collectionFilterCards, filters).filter((card) => {
      const entry = entryByKey.get(card.id)
      return finish === 'ALL' || (entry != null && effectiveCardFinish(entry.rarity, entry.finish) === finish)
    })
    if (sort === 'recent' || sort === 'quantity') return filtered.map((card) => entryByKey.get(card.id)).filter((entry): entry is CollectionEntry => entry != null).sort((a, b) => sort === 'quantity' ? b.quantity - a.quantity : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return sortCards(filtered, sort).map((card) => entryByKey.get(card.id)).filter((entry): entry is CollectionEntry => entry != null)
  }, [collectionFilterCards, entryByKey, filters, finish, sort])

  function downloadDreambornCsv() {
    const rows = entries.map((entry) => [
      entry.set_code,
      entry.collector_number,
      effectiveCardFinish(entry.rarity, entry.finish) === 'FOIL' ? 'foil' : 'normal',
      entry.quantity,
    ])
    const csv = [
      'Set Number,Card Number,Variant,Count',
      ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n') + '\r\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `lorcana-dreamborn-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const copies = entries.reduce((sum, entry) => sum + entry.quantity, 0)
    const unique = new Set(entries.map((entry) => entry.card_id)).size
    const value = entries.reduce((sum, entry) => {
      const price = cardPrice(entry, entry.finish)
      return sum + (price ?? 0) * entry.quantity
    }, 0)
    return { copies, unique, value }
  }, [entries])

  async function changeQuantity(entry: CollectionEntry, delta: number) {
    const next = Math.max(0, entry.quantity + delta)
    const key = collectionEntryKey(entry)
    if (delta > 0) localQuantityUpdates.current.set(key, next)
    setEntries((current) => current.map((item) => item === entry ? { ...item, quantity: next } : item).filter((item) => item.quantity > 0))
    const { error: updateError } = await supabase
      .from('collection_entries')
      .update({ quantity: next })
      .eq('user_id', entry.user_id)
      .eq('card_id', entry.card_id)
      .eq('language', entry.language)
      .eq('finish', entry.finish)
    if (updateError) {
      localQuantityUpdates.current.delete(key)
      setError(updateError.message)
      void loadCollection()
    }
  }

  async function importStarterDeck(deck: StarterDeck, language: string) {
    if (starterImportInFlight.current) return
    if (deck.missing.length || starterDeckTotals(deck).copies !== 60) throw new Error('El mazo no está completo en el catálogo.')
    starterImportInFlight.current = true
    setStarterImportBusy(true)
    try {
      const cardIds = deck.cards.map(({ card }) => card.id)
      const { data: stored, error: readError } = await supabase
        .from('collection_entries')
        .select('card_id,language,finish,quantity')
        .eq('user_id', session.user.id)
        .eq('language', language)
        .in('card_id', cardIds)
      if (readError) throw readError
      const existing = new Map((stored ?? []).map((entry) => [`${entry.card_id}-${entry.language}-${entry.finish}`, entry.quantity as number]))
      const rows = deck.cards.map(({ card, quantity, finish }) => ({
        user_id: session.user.id,
        card_id: card.id,
        language,
        finish,
        quantity: (existing.get(`${card.id}-${language}-${finish}`) ?? 0) + quantity,
        card_name: card.name,
        card_version: card.version,
        set_code: card.set_code,
        set_name: card.set_name,
        collector_number: card.collector_number,
        image_url: card.image_url,
        ink: card.ink,
        rarity: card.rarity,
        normal_price_eur: card.normal_price_eur,
        foil_price_eur: card.foil_price_eur,
      }))
      const { error: writeError } = await supabase.from('collection_entries').upsert(rows, { onConflict: 'user_id,card_id,language,finish' })
      if (writeError) throw writeError
      setStarterImportMessage(`${deck.name}: ${starterDeckTotals(deck).copies} cartas añadidas, incluidas ${starterDeckTotals(deck).foil} foil.`)
      setStarterImporterOpen(false)
      await loadCollection()
    } finally {
      starterImportInFlight.current = false
      setStarterImportBusy(false)
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Se eliminarán permanentemente tu cuenta y toda la colección sincronizada. Esta acción no se puede deshacer.',
    )
    if (!confirmed) return
    const { error: deleteError } = await supabase.rpc('delete_own_account')
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
  }

  const activeViewLabel = activeView === 'collection' ? 'Colección' : activeView === 'catalog' ? 'Catálogo' : 'Mazos'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup compact">
          <span className="brand-mark"><Sparkles aria-hidden="true" /></span>
          <div><p className="eyebrow">Lorcana Lector</p><strong className="current-view-label">{activeViewLabel}<i title="Sincronización activa" aria-label="Sincronización activa" /></strong></div>
        </div>
        <div className="account-actions">
          <span><CircleUserRound aria-hidden="true" />{session.user.email}</span>
          <button
            className={`icon-command${soundEnabled ? ' sound-on' : ''}`}
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (next) void playValuableCardSound()
            }}
            title={soundEnabled ? 'Desactivar sonido de cartas valiosas' : 'Activar sonido de cartas valiosas'}
            aria-label={soundEnabled ? 'Desactivar sonido de cartas valiosas' : 'Activar sonido de cartas valiosas'}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </button>
          <button className="icon-command danger" onClick={() => void deleteAccount()} title="Eliminar cuenta y datos" aria-label="Eliminar cuenta y datos"><Trash2 /></button>
          <button className="icon-command" onClick={() => void supabase.auth.signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut /></button>
        </div>
      </header>

      <main className={`collection-main view-${activeView}`}>
        <section className="view-navigation">
          <nav className="view-tabs" aria-label="Vistas de la cuenta">
            <button className={activeView === 'collection' ? 'active' : ''} onClick={() => setActiveView('collection')}><Layers3 aria-hidden="true" />Colección</button>
            <button className={activeView === 'catalog' ? 'active' : ''} onClick={() => setActiveView('catalog')}><LibraryBig aria-hidden="true" />Catálogo</button>
            <button className={activeView === 'decks' ? 'active' : ''} onClick={() => setActiveView('decks')}><ListChecks aria-hidden="true" />Mazos</button>
          </nav>
          {activeView === 'collection' && <button className="starter-import-open" onClick={() => { setStarterImportMessage(''); setStarterImporterOpen(true) }} disabled={catalogMetadata.length === 0} title="Importar mazo comprado"><PackagePlus aria-hidden="true" /><span>Importar mazo comprado</span></button>}
          {activeView === 'collection' && <button className="export-command" onClick={downloadDreambornCsv} disabled={entries.length === 0} title="Exportar a Dreamborn" aria-label="Exportar a Dreamborn">
            <Download aria-hidden="true" /><span>Exportar a Dreamborn</span>
          </button>}
        </section>

        {error && <p className="notice error">No se pudo actualizar la colección: {error}</p>}
        {activeView === 'collection' && starterImportMessage && <p className="notice success" role="status">{starterImportMessage}</p>}
        {loading ? <LoadingScreen /> : activeView === 'collection' ? <>
          <section className="collection-overview" aria-label="Resumen de la colección">
            <Stat label="Cartas distintas" value={stats.unique.toLocaleString('es-ES')} />
            <Stat label="Copias totales" value={stats.copies.toLocaleString('es-ES')} />
            <Stat label="Valor estimado" value={stats.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
          </section>

          <div className="collection-modebar">
            <div className="collection-mode-switch" role="group" aria-label="Organizar colección">
              <button className={collectionMode === 'cards' ? 'active' : ''} onClick={() => setCollectionMode('cards')}><Layers3 aria-hidden="true" />Cartas</button>
              <button className={collectionMode === 'sets' ? 'active' : ''} onClick={() => setCollectionMode('sets')}><Rows3 aria-hidden="true" />Por sets</button>
            </div>
            <p>{collectionMode === 'cards' ? 'Gestiona copias y acabados' : 'Progreso, master set y cartas pendientes'}</p>
          </div>

          {collectionMode === 'cards' ? <>
          <section className="collection-tools" aria-label="Filtros de colección">
          <CardFilterBar cards={collectionFilterCards} filters={filters} onFiltersChange={setFilters} sort={sort} sortOptions={COLLECTION_SORT_OPTIONS} onSortChange={(value) => setSort(value as CollectionSortMode)} resultCount={visibleEntries.length} totalCount={entries.length} extraActiveCount={finish === 'ALL' ? 0 : 1} onReset={() => setFinish('ALL')} specificControls={<div className="specific-filter-control"><span>Acabado</span><div>{(['ALL', 'NORMAL', 'FOIL'] as FinishFilter[]).map((value) => <button key={value} className={finish === value ? 'active' : ''} onClick={() => setFinish(value)}>{value === 'ALL' ? 'Todos' : value === 'NORMAL' ? 'Normal' : 'Foil'}</button>)}</div></div>} />
          <div className="display-strip">
            <span><SlidersHorizontal aria-hidden="true" />Tamaño</span>
            <div className="zoom-control" aria-label="Tamaño de las cartas">
              <button type="button" onClick={() => setCardSize((current) => Math.max(CARD_SIZE_MIN, current - CARD_SIZE_STEP))} disabled={cardSize === CARD_SIZE_MIN} title="Reducir cartas" aria-label="Reducir cartas"><ZoomOut /></button>
              <input type="range" min={CARD_SIZE_MIN} max={CARD_SIZE_MAX} step={CARD_SIZE_STEP} value={cardSize} onChange={(event) => setCardSize(Number(event.target.value))} aria-label="Tamaño de las cartas" aria-valuetext={`${cardSize} píxeles`} />
              <button type="button" onClick={() => setCardSize((current) => Math.min(CARD_SIZE_MAX, current + CARD_SIZE_STEP))} disabled={cardSize === CARD_SIZE_MAX} title="Aumentar cartas" aria-label="Aumentar cartas"><ZoomIn /></button>
            </div>
          </div>
          </section>

          {visibleEntries.length === 0 ? (
            <section className="empty-state"><Sparkles aria-hidden="true" /><h2>Tu colección está esperando</h2><p>Escanea una carta desde la aplicación Android para verla aquí.</p></section>
          ) : (
            <section className="card-grid" aria-label="Cartas de la colección" style={{ '--card-size': `${cardSize}px` } as CSSProperties}>
              {visibleEntries.map((entry) => {
                const key = collectionEntryKey(entry)
                return <CollectionCard key={key} entry={entry} onChange={changeQuantity} onOpen={setSelectedEntry} isNew={newEntryKeys.has(key)} trend={priceTrendFor(priceHistory[key])} />
              })}
            </section>
          )}
          </> : <SetCollectionView entries={entries} />}
        </> : activeView === 'catalog' ? <CatalogBrowser /> : <DeckStudio session={session} collection={entries} />}
      </main>
      {selectedEntry && <CardViewer card={{ name: selectedEntry.card_name, version: selectedEntry.card_version, imageUrl: selectedEntry.image_url, setCode: selectedEntry.set_code, collectorNumber: selectedEntry.collector_number, rarity: selectedEntry.rarity, ink: selectedEntry.ink, normalPriceEur: selectedEntry.normal_price_eur, foilPriceEur: selectedEntry.foil_price_eur }} foil={effectiveCardFinish(selectedEntry.rarity, selectedEntry.finish) === 'FOIL'} onClose={() => setSelectedEntry(null)} />}
      {arrivalCelebration && <ScanArrivalCelebration key={arrivalCelebration.nonce} entry={arrivalCelebration.entry} jackpot={arrivalCelebration.jackpot} />}
      {starterImporterOpen && <StarterDeckImporter catalog={catalogMetadata} busy={starterImportBusy} onClose={() => setStarterImporterOpen(false)} onImport={importStarterDeck} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>
}

function CollectionCard({ entry, onChange, onOpen, isNew, trend }: { entry: CollectionEntry; onChange: (entry: CollectionEntry, delta: number) => void; onOpen: (entry: CollectionEntry) => void; isNew: boolean; trend: { amount: number; percent: number } | null }) {
  const effectiveFinish = effectiveCardFinish(entry.rarity, entry.finish)
  const price = cardPrice(entry, entry.finish)
  return (
    <article className={`collection-card${isNew ? ' is-new' : ''}`}>
      {isNew && <span className="arrival-badge"><Sparkles aria-hidden="true" />Nueva</span>}
      <button className="card-image-wrap" onClick={() => onOpen(entry)} aria-label={`Ver ${entry.card_name}, ${entry.card_version}`}>
        {entry.image_url ? <img src={entry.image_url} alt={`${entry.card_name}, ${entry.card_version}`} loading="lazy" /> : <div className="image-placeholder"><Sparkles aria-hidden="true" /></div>}
        <span className={`finish-badge ${effectiveFinish.toLowerCase()}`}>{effectiveFinish === 'FOIL' ? 'Foil' : 'Normal'}</span>
      </button>
      <div className="card-copy">
        <p className="card-set">{entry.set_code} · #{entry.collector_number}</p>
        <h2>{entry.card_name}</h2>
        <p className="card-version">{entry.card_version || entry.set_name}</p>
        <div className="card-meta"><span>{entry.rarity}</span><span>{entry.ink || 'Sin tinta'}</span></div>
        <div className="card-footer">
          <span className="price-stack"><span className="price">{price == null ? 'Sin precio' : price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>{trend && <small className={trend.amount > 0 ? 'price-up' : 'price-down'}>{trend.amount > 0 ? '▲' : '▼'} {Math.abs(trend.percent).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</small>}</span>
          <div className="stepper" aria-label={`Cantidad de ${entry.card_name}`}>
            <button onClick={() => void onChange(entry, -1)} aria-label={`Quitar una copia de ${entry.card_name}`}><Minus /></button>
            <output>{entry.quantity}</output>
            <button onClick={() => void onChange(entry, 1)} aria-label={`Añadir una copia de ${entry.card_name}`}><Plus /></button>
          </div>
        </div>
      </div>
    </article>
  )
}

function ScanArrivalCelebration({ entry, jackpot }: { entry: CollectionEntry; jackpot: boolean }) {
  const price = cardPrice(entry, entry.finish)
  return <div className={`scan-celebration${jackpot ? ' jackpot' : ''}`} role="status" aria-live="polite">
    <div className="celebration-burst" aria-hidden="true">{Array.from({ length: jackpot ? 18 : 8 }, (_, index) => <i key={index} />)}</div>
    {entry.image_url && <img src={entry.image_url} alt="" />}
    <div><span>{jackpot ? '¡Premio grande!' : 'Carta valiosa añadida'}</span><strong>{entry.card_name}</strong><b>{price?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</b></div>
  </div>
}
