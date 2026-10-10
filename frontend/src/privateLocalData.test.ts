import { describe, expect, it } from 'vitest'
import { clearPrivateLocalData, setPrivateLocalDataOwner, writePrivateLocalData } from './privateLocalData'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('private browser data', () => {
  it('removes every account draft and price history on sign-out while keeping preferences', () => {
    const storage = memoryStorage({
      'lorcana-deck-draft:user-1': 'private draft',
      'lorcana-price-history:user-1': 'private prices',
      'lorcana-deck-draft:user-2': 'other private draft',
      'lorcana-card-size': '180',
      'lorcana-valuable-sound': 'off',
    })

    setPrivateLocalDataOwner('user-1', storage)
    setPrivateLocalDataOwner(null, storage)

    expect(storage.getItem('lorcana-deck-draft:user-1')).toBeNull()
    expect(storage.getItem('lorcana-price-history:user-1')).toBeNull()
    expect(storage.getItem('lorcana-deck-draft:user-2')).toBeNull()
    expect(storage.getItem('lorcana-card-size')).toBe('180')
    expect(storage.getItem('lorcana-valuable-sound')).toBe('off')
  })

  it('blocks delayed writes after deletion or sign-out and allows writes for a new session', () => {
    const storage = memoryStorage()
    setPrivateLocalDataOwner('user-1', storage)
    writePrivateLocalData('user-1', 'lorcana-deck-draft:user-1', 'draft', storage)
    clearPrivateLocalData(storage)
    writePrivateLocalData('user-1', 'lorcana-deck-draft:user-1', 'late draft', storage)
    writePrivateLocalData('user-1', 'lorcana-price-history:user-1', 'late prices', storage)

    expect(storage.length).toBe(0)

    setPrivateLocalDataOwner('user-2', storage)
    writePrivateLocalData('user-1', 'lorcana-deck-draft:user-1', 'old account', storage)
    writePrivateLocalData('user-2', 'lorcana-deck-draft:user-2', 'new account', storage)
    expect(storage.getItem('lorcana-deck-draft:user-1')).toBeNull()
    expect(storage.getItem('lorcana-deck-draft:user-2')).toBe('new account')
    setPrivateLocalDataOwner(null, storage)
  })

  it('clears the former account when auth switches directly to another account', () => {
    const storage = memoryStorage({ 'lorcana-price-history:user-1': 'private prices' })
    setPrivateLocalDataOwner('user-1', storage)
    setPrivateLocalDataOwner('user-2', storage)
    expect(storage.getItem('lorcana-price-history:user-1')).toBeNull()
    setPrivateLocalDataOwner(null, storage)
  })
})
