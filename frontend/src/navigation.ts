import { useSyncExternalStore } from 'react'

export type AppView = 'catalog' | 'albums' | 'collection' | 'decks'
export const viewLabels: Record<AppView, string> = { catalog: 'Catálogo', albums: 'Álbumes', collection: 'Mi colección', decks: 'Mis mazos' }
export function readView(search: string): AppView {
  const view = new URLSearchParams(search).get('view')
  return view === 'albums' || view === 'collection' || view === 'decks' ? view : 'catalog'
}
export function appUrl(view: AppView, auth = false) {
  const params = new URLSearchParams({ view })
  if (auth) params.set('auth', '1')
  return `${import.meta.env.BASE_URL}?${params}`
}
export function navigate(view: AppView, auth = false, replace = false) {
  const destination = new URL(appUrl(view, auth), window.location.origin)
  const previousParams = new URLSearchParams(window.location.search)
  if (view === readView(window.location.search)) {
    for (const key of ['album', 'editor']) {
      const value = previousParams.get(key)
      if (value) destination.searchParams.set(key, value)
    }
  }
  if (auth) {
    const previous = new URLSearchParams(window.location.search)
    const from = previous.get('from') ?? readView(window.location.search)
    if (from === 'catalog' || from === 'albums') destination.searchParams.set('from', from)
  }
  window.history[replace ? 'replaceState' : 'pushState'](auth ? { authFrom: window.location.pathname + window.location.search } : null, '', destination.pathname + destination.search)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function cancelSignIn() {
  if (window.history.state?.authFrom) window.history.back()
  else {
    const from = new URLSearchParams(window.location.search).get('from')
    navigate(from === 'albums' ? 'albums' : 'catalog', false, true)
  }
}
const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}
export function useAppLocation() {
  const search = useSyncExternalStore(subscribe, () => window.location.search)
  const params = new URLSearchParams(search)
  return { view: readView(search), auth: params.get('auth') === '1', album: params.get('album'), editor: params.get('editor') }
}

export function setRouteParameter(key: string, value: string | null, replace = false) {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  window.history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search)
  window.dispatchEvent(new PopStateEvent("popstate"))
}
