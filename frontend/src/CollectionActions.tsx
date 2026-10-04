import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, PackagePlus } from 'lucide-react'

export function CollectionActions({ canImport, canExport, onImport, onExport }: {
  canImport: boolean; canExport: boolean; onImport: () => void; onExport: () => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const run = (action: () => void) => { setOpen(false); trigger.current?.focus(); action() }
  return <div className="collection-actions" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <button className="actions-trigger" ref={trigger} aria-expanded={open} aria-controls="collection-actions-panel" onClick={() => setOpen(value => !value)}>Acciones<ChevronDown aria-hidden="true" /></button>
    {open && <div className="actions-panel" id="collection-actions-panel">
      <button disabled={!canImport} onClick={() => run(onImport)}><PackagePlus aria-hidden="true" />Importar mazo comprado</button>
      <button disabled={!canExport} onClick={() => run(onExport)}><Download aria-hidden="true" />Exportar a Dreamborn</button>
    </div>}
  </div>
}
