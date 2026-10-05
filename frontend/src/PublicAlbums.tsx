import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { loadCatalog, type CatalogCard } from './catalog'
import { CatalogBrowser } from './CatalogBrowser'

export function PublicAlbums({ onRequireSignIn }: { onRequireSignIn: () => void }) {
  const [cards, setCards] = useState<CatalogCard[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; loadCatalog().then(data => { if (active) setCards(data) }).catch(() => { if (active) setError('No se pudieron cargar los álbumes. Vuelve a intentarlo recargando la página.') }); return () => { active = false } }, [])
  const sets = useMemo(() => {
    const grouped = new Map<string, { code: string; name: string; count: number; image: string | null }>()
    cards.forEach(card => {
      const set = grouped.get(card.set_code)
      if (set) set.count++
      else grouped.set(card.set_code, { code: card.set_code, name: card.set_name, count: 1, image: card.image_url })
    })
    return [...grouped.values()].sort((a, b) => (Number(a.code) || 10000) - (Number(b.code) || 10000) || a.code.localeCompare(b.code)).filter(set => `${set.code} ${set.name}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es').trim()))
  }, [cards, query])
  if (selected) return <section><button className="text-command album-back" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" />Todos los álbumes</button><CatalogBrowser key={selected} initialSet={selected} onRequireSignIn={onRequireSignIn} /></section>
  return <section className="public-albums">
    <header><h1>Álbumes por edición</h1><p>Explora todas las cartas sin crear una cuenta.</p><label className="album-search"><Search aria-hidden="true" /><input placeholder="Buscar edición" aria-label="Buscar edición" value={query} onChange={e => setQuery(e.target.value)} /></label></header>
    {error ? <p className="notice error" role="alert">{error}</p> : cards.length === 0 ? <p role="status">Preparando los álbumes…</p> : <div className="public-album-list">{sets.map(set => <button key={set.code} onClick={() => setSelected(set.code)}>{set.image && <img src={set.image} alt="" loading="lazy" />}<span><small>Edición {set.code}</small><strong>{set.name}</strong><small>{set.count} cartas en el catálogo</small></span><ChevronRight aria-hidden="true" /></button>)}</div>}
    {cards.length > 0 && sets.length === 0 && <p>No hay ediciones con esa búsqueda.</p>}
  </section>
}
