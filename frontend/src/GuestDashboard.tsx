import { useState } from 'react'
import { CircleUserRound, Layers3, LibraryBig, ListChecks } from 'lucide-react'
import { ThemeToggle } from '../../shared/ThemeToggle'
import { CatalogBrowser } from './CatalogBrowser'
import { PublicAlbums } from './PublicAlbums'

export function GuestDashboard({ onSignIn }: { onSignIn: () => void }) {
  const [view, setView] = useState<'catalog' | 'albums'>('catalog')
  const navigation = <>
    <button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><LibraryBig aria-hidden="true" />Catálogo</button>
    <button className={view === 'albums' ? 'active' : ''} onClick={() => setView('albums')}><Layers3 aria-hidden="true" />Álbumes</button>
    <button onClick={onSignIn}><CircleUserRound aria-hidden="true" />Mi colección</button>
    <button onClick={onSignIn}><ListChecks aria-hidden="true" />Mazos</button>
  </>
  return <div className="app-shell guest-shell">
    <header className="topbar">
      <div className="brand-lockup compact"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}ink-icons/amethyst.png`} alt="" width="30" height="30" /></span><div><span className="app-brand-name">MiTinta</span><strong className="current-view-label">{view === 'catalog' ? 'Catálogo' : 'Álbumes'}</strong></div></div>
      <nav className="view-tabs desktop-view-tabs" aria-label="Navegación">{navigation}</nav>
      <div className="header-actions"><ThemeToggle /><button className="guest-signin" onClick={onSignIn}>Entrar</button></div>
    </header>
    <main className="collection-main">
      {view === 'catalog' ? <CatalogBrowser onRequireSignIn={onSignIn} /> : <PublicAlbums onRequireSignIn={onSignIn} />}
    </main>
    <nav className="app-bottom-nav" aria-label="Navegación">{navigation}</nav>
  </div>
}
