const PRIVATE_KEY_PREFIXES = ['lorcana-deck-draft:', 'lorcana-price-history:']

let activeOwner: string | null = null

export function clearPrivateLocalData(storage: Storage = window.localStorage) {
  activeOwner = null
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  keys.forEach((key) => {
    if (key && PRIVATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key)
  })
}

export function setPrivateLocalDataOwner(userId: string | null, storage: Storage = window.localStorage) {
  if (!userId) {
    clearPrivateLocalData(storage)
    return
  }
  if (activeOwner && activeOwner !== userId) clearPrivateLocalData(storage)
  activeOwner = userId
}

export function writePrivateLocalData(userId: string, key: string, value: string, storage: Storage = window.localStorage) {
  if (activeOwner === userId) storage.setItem(key, value)
}
