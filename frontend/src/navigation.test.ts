import { afterEach, describe, expect, it, vi } from 'vitest'
import { appUrl, cancelSignIn, navigate, readView } from './navigation'

afterEach(() => vi.unstubAllGlobals())

function browser(search: string, state: unknown = null) {
  const history = { state, pushState: vi.fn(), replaceState: vi.fn(), back: vi.fn() }
  vi.stubGlobal('window', { location: { search, pathname: '/collection/', origin: 'https://mitinta.app' }, history, dispatchEvent: vi.fn() })
  vi.stubGlobal('PopStateEvent', Event)
  return history
}

describe('section navigation and authentication return paths', () => {
  it.each(['catalog', 'albums', 'collection', 'decks'])('resolves the %s destination', view => {
    expect(readView(`?view=${view}`)).toBe(view)
  })

  it('falls back to the public catalogue for unknown or external destinations', () => {
    expect(readView('?view=https://example.com')).toBe('catalog')
    expect(readView('')).toBe('catalog')
  })

  it('keeps the private destination and a public return route when signing in', () => {
    const history = browser('?view=albums&album=1')
    navigate('decks', true)
    const [state, , url] = history.pushState.mock.calls[0]
    expect(state).toEqual({ authFrom: '/collection/?view=albums&album=1' })
    expect(url).toBe(`${appUrl('decks', true)}&from=albums`)
  })

  it('preserves the selected album when finishing authentication on that section', () => {
    const history = browser('?view=albums&album=1&auth=1')
    navigate('albums', false, true)
    expect(history.replaceState.mock.calls[0][2]).toBe(`${appUrl('albums')}&album=1`)
  })

  it('cancels sign-in through history to keep the exact previous screen', () => {
    const history = browser('?view=decks&auth=1', { authFrom: '/collection/?view=albums&album=1' })
    cancelSignIn()
    expect(history.back).toHaveBeenCalledOnce()
    expect(history.pushState).not.toHaveBeenCalled()
  })

  it('replaces a direct private link with a public screen when cancelling', () => {
    const history = browser('?view=decks&from=https://example.com')
    cancelSignIn()
    expect(history.replaceState.mock.calls[0][2]).toBe(appUrl('catalog'))
  })
})
