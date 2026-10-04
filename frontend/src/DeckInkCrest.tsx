import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { animateDeckInk, animateDeckInkAmbient } from './deckInkAnimation'
import './deckInkCrest.css'

const inkStyle: Record<string, { color: string; name: string }> = {
  Amber: { color: '#dca320', name: 'Ámbar' }, Amethyst: { color: '#9856cf', name: 'Amatista' },
  Emerald: { color: '#29a46c', name: 'Esmeralda' }, Ruby: { color: '#e04a59', name: 'Rubí' },
  Sapphire: { color: '#329be0', name: 'Zafiro' }, Steel: { color: '#8a9bad', name: 'Acero' },
}

export function DeckInkCrest({ inks, baseInks, invalid = false }: { inks: string[]; baseInks: string[]; invalid?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ambient = useRef<HTMLCanvasElement>(null)
  const previous = useRef(inks.join('|'))
  const signature = inks.join('|')
  useLayoutEffect(() => {
    if (!host.current || !ambient.current) return
    return animateDeckInkAmbient(ambient.current, host.current, Object.fromEntries(Object.entries(inkStyle).map(([ink, style]) => [ink, style.color])))
  }, [signature])
  useLayoutEffect(() => {
    const old = previous.current.split('|')
    previous.current = signature
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    if (!host.current || !canvas.current || old.join('|') === signature || reducedMotion.matches) return
    const surface = canvas.current
    const seals = [...host.current.querySelectorAll<HTMLElement>('.deck-ink-seal')]
    const animations: Animation[] = []
    let disposed = false
    let stop = () => {}
    const images = seals.map(seal => seal.querySelector<HTMLImageElement>('img')!)
    seals.forEach(seal => { if (!old.includes(seal.dataset.ink ?? '')) seal.classList.add('forming') })
    const cancel = () => {
      disposed = true; stop(); animations.forEach(animation => animation.cancel())
      seals.forEach(seal => seal.classList.remove('forming'))
    }
    const onMotionChange = () => { if (reducedMotion.matches) cancel() }
    reducedMotion.addEventListener('change', onMotionChange)
    Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => {
      if (disposed) return
      const bounds = surface.getBoundingClientRect()
      const targets = seals.map((seal, index) => {
        const box = seal.getBoundingClientRect()
        const fresh = !old.includes(seal.dataset.ink ?? '')
        if (fresh) animations.push(images[index].animate([
          { opacity: 0, transform: 'scale(.94)', offset: 0 },
          { opacity: 0, transform: 'scale(.94)', offset: .5 },
          { opacity: 1, transform: 'scale(1.13)', offset: .72 },
          { opacity: 1, transform: 'scale(1)', offset: 1 },
        ], { duration: 1500, easing: 'cubic-bezier(.22,1,.36,1)' }))
        seal.classList.remove('forming')
        animations.push(seal.animate([
          { transform: `translateX(${index % 2 ? 7 : -7}px)`, offset: 0 },
          { transform: 'translateX(0) scale(1.06)', offset: .6 },
          { transform: 'translateX(0) scale(1)', offset: 1 },
        ], { duration: 1600, easing: 'cubic-bezier(.22,1,.36,1)' }))
        return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top,
          color: inkStyle[seal.dataset.ink!].color, image: images[index], fresh }
      })
      stop = animateDeckInk(surface, targets)
    })
    return () => { cancel(); reducedMotion.removeEventListener('change', onMotionChange) }
  }, [signature])
  const known = inks.filter(ink => inkStyle[ink])
  const label = known.map(ink => inkStyle[ink].name).join(' + ')
  return <div ref={host} className={`deck-ink-crest${known.length > 1 ? ' combined' : ''}${invalid ? ' invalid' : ''}`} role="img" aria-label={label ? `Tintas: ${label}${invalid ? '. Combinación no válida' : ''}` : 'Sin tinta: añade tu primera carta'} title={label || 'Tu tinta se formará aquí'} style={{ '--crest-a': inkStyle[known[0]]?.color ?? '#9856cf', '--crest-b': inkStyle[known[1]]?.color ?? inkStyle[known[0]]?.color ?? '#329be0' } as CSSProperties}>
    <canvas ref={ambient} className="deck-ink-ambient" aria-hidden="true" />
    <canvas ref={canvas} className="deck-ink-energy" aria-hidden="true" />
    <div className="deck-ink-seals">
      {known.map(ink => <span key={ink} data-ink={ink} className={`deck-ink-seal${baseInks.includes(ink) ? '' : ' guest'}`} style={{ '--seal-color': inkStyle[ink].color } as CSSProperties}>
        <img src={`${import.meta.env.BASE_URL}ink-icons/${ink.toLowerCase()}.png`} alt="" /><i aria-hidden="true" />
      </span>)}
      {!known.length && <span className="deck-ink-unformed" aria-hidden="true">✦</span>}
    </div>
  </div>
}
