export const MAX_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_ROWS = 100_000
export const MAX_COLLECTION_QUANTITY = 1_000_000
export const MAX_COLLECTION_ENTRIES = 50_000

export function validateImportText(content: string) {
  if (content.length > MAX_IMPORT_BYTES || new TextEncoder().encode(content).byteLength > MAX_IMPORT_BYTES) {
    throw new Error('El archivo supera los 10 MiB.')
  }
  let rows = 1
  for (const char of content) if (char === '\n' && ++rows > MAX_IMPORT_ROWS + 1) {
    throw new Error('El archivo supera las 100.000 filas.')
  }
}

export async function readImportFile(file: Pick<File, 'size' | 'text'>) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('El archivo supera los 10 MiB.')
  const content = await file.text()
  validateImportText(content)
  return content
}

export function checkedQuantity(quantity: number, previous = 0) {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || (quantity > MAX_COLLECTION_QUANTITY && quantity > previous)) {
    throw new Error('Máximo 1.000.000 copias por entrada.')
  }
  return quantity
}

export function storageError(error: { code?: string; message: string }) {
  if (error.message.includes('collection_quota')) return 'Has alcanzado las 50.000 entradas de colección. Elimina entradas para añadir otras.'
  if (error.message.includes('collection_quantity')) return 'Máximo 1.000.000 copias por entrada.'
  if (error.message.includes('collection_text')) return 'Los datos de esta carta superan el tamaño permitido.'
  if (error.code === '23514') return 'Los datos superan los límites de almacenamiento. Revisa las cantidades y el tamaño del mazo.'
  return error.message
}

/** External formats must retain their identifiers: fail rather than rewrite. */
export function externalCsvCell(value: string | number) {
  const text = String(value)
  if (typeof value === 'string' && (/^[\s\x00-\x1f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))) {
    throw new Error('La exportación contiene un identificador no seguro para hojas de cálculo.')
  }
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
