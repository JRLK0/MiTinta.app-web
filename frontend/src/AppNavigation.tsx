import { CircleUserRound, Layers3, LibraryBig, ListChecks } from 'lucide-react'
import { appUrl, viewLabels, type AppView } from './navigation'

export function AppNavigation({ view, onNavigate }: { view: AppView; onNavigate: (view: AppView) => void }) {
  return (['catalog', 'albums', 'collection', 'decks'] as const).map(target => {
    const Icon = { catalog: LibraryBig, albums: Layers3, collection: CircleUserRound, decks: ListChecks }[target]
    return <a key={target} href={appUrl(target)} className={target === view ? 'active' : ''} aria-current={target === view ? 'page' : undefined} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); onNavigate(target)
    }}><Icon aria-hidden="true" />{viewLabels[target]}</a>
  })
}
