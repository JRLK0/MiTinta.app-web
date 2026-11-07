import { AppNavigation } from './AppNavigation'
import { navigate, useAppLocation } from './navigation'
import { ThemeToggle } from '../../shared/ThemeToggle'
import { CatalogBrowser } from './CatalogBrowser'
import { PublicAlbums } from './PublicAlbums'

export function GuestDashboard({ onSignIn }: { onSignIn: () => void }) {
  const { view } = useAppLocation()
  const navigation = <AppNavigation view={view} onNavigate={target => navigate(target, target === 'collection' || target === 'decks')} />
  return <div className="app-shell guest-shell">
    <header className="topbar">
      <div className="brand-lockup compact"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}ink-icons/amethyst.png`} alt="" width="30" height="30" /></span><div><a className="app-brand-name" href="/" aria-label="MiTinta, inicio">MiTinta</a><strong className="current-view-label">{view === 'catalog' ? 'Catálogo' : 'Álbumes'}</strong></div></div>
      <nav className="view-tabs desktop-view-tabs" aria-label="Navegación">{navigation}</nav>
      <div className="header-actions"><ThemeToggle /><button className="guest-signin" onClick={onSignIn}>Entrar</button></div>
    </header>
    <main className="collection-main">
      {view === 'catalog' ? <CatalogBrowser onRequireSignIn={onSignIn} /> : <PublicAlbums onRequireSignIn={onSignIn} />}
    </main>
    <nav className="app-bottom-nav" aria-label="Navegación">{navigation}</nav>
  </div>
}
