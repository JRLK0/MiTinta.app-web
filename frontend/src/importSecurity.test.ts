import { expect, it, vi } from 'vitest'
import { checkedQuantity, externalCsvCell, MAX_IMPORT_BYTES, readImportFile, validateImportText } from './importSecurity'
import { parseDeck } from './deckImport'

it('rejects oversized files before reading and counts actual UTF-8 bytes', async () => {
  const text = vi.fn()
  await expect(readImportFile({ size: MAX_IMPORT_BYTES + 1, text })).rejects.toThrow('10 MiB')
  expect(text).not.toHaveBeenCalled()
  expect(() => validateImportText('é'.repeat(MAX_IMPORT_BYTES / 2 + 1))).toThrow('10 MiB')
  expect(() => validateImportText('1 card\n'.repeat(100_001))).toThrow('100.000')
})

it('rejects numeric overflow and duplicate totals before returning a deck', () => {
  expect(() => parseDeck('Count,Name\n2147483647,Elsa\n2147483647,Elsa')).toThrow()
  expect(() => parseDeck('600000 Elsa\n600000 Elsa')).toThrow()
  expect(() => parseDeck('9007199254740993 Elsa')).toThrow()
  expect(parseDeck('500000 Elsa\n500000 Elsa')[0].count).toBe(1_000_000)
  expect(checkedQuantity(1_000_000)).toBe(1_000_000)
  expect(() => checkedQuantity(1.5)).toThrow()
  expect(checkedQuantity(1_000_001, 1_000_002)).toBe(1_000_001)
  expect(() => checkedQuantity(1_000_003, 1_000_002)).toThrow()
})

it('rejects formula identifiers without changing external formats', () => {
  for (const value of ['=1+1', '+cmd', '-1', '@sum(1)', ' \t=2', '\rhello']) {
    expect(() => externalCsvCell(value)).toThrow()
  }
  expect(externalCsvCell('1')).toBe('1')
  expect(externalCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"')
})
