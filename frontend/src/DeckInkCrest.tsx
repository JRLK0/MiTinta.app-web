import { useEffect, useRef, type CSSProperties } from 'react'
import './deckInkCrest.css'

const inkStyle: Record<string, { color: string; name: string }> = {
  Amber: { color: '#dfaa24', name: 'Ámbar' }, Amethyst: { color: '#9856cf', name: 'Amatista' },
  Emerald: { color: '#29a46c', name: 'Esmeralda' }, Ruby: { color: '#e04a59', name: 'Rubí' },
  Sapphire: { color: '#329be0', name: 'Zafiro' }, Steel: { color: '#8a9bad', name: 'Acero' },
}

export function DeckInkCrest({ inks, baseInks, invalid = false }: { inks: string[]; baseInks: string[]; invalid?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const previous = useRef(inks.join('|'))
  const signature = inks.join('|')
  useEffect(() => {
    const old = previous.current.split('|')
    previous.current = signature
    if (!host.current || old.join('|') === signature || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animations: Animation[] = []
    host.current.querySelectorAll<HTMLElement>('.deck-ink-seal').forEach(seal => {
      if (old.includes(seal.dataset.ink ?? '')) return
      animations.push(seal.animate([
        { opacity: 0, transform: 'translateY(10px) scale(.85) rotate(-18deg)', filter: 'blur(5px)' },
        { opacity: 1, transform: 'translateY(-2px) scale(1.12) rotate(4deg)', filter: 'blur(0px)', offset: .62 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(0deg)', filter: 'blur(0px)' },
      ], { duration: 850, easing: 'cubic-bezier(.16,1,.3,1)' }))
      seal.querySelectorAll('.deck-ink-fragment').forEach((fragment, index) => {
        const x = index % 2 ? 32 : -32
        const y = index < 2 ? -28 : 28
        animations.push(fragment.animate([
          { opacity: 0, transform: `translate(${x}px,${y}px) rotate(${x}deg)`, filter: 'blur(3px)' },
          { opacity: 1, offset: .3 },
          { opacity: 1, transform: 'translate(0,0) rotate(0deg)', filter: 'blur(0px)', offset: .72 },
          { opacity: 0, transform: 'translate(0,0) rotate(0deg)' },
        ], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' }))
      })
    })
    const fusion = host.current.querySelector('.deck-ink-fusion')
    if (fusion && inks.length) animations.push(fusion.animate([
      { opacity: 0, transform: 'scale(.65) rotate(-90deg)' },
      { opacity: .9, transform: 'scale(1.12) rotate(20deg)', offset: .45 },
      { opacity: 0, transform: 'scale(1.5) rotate(65deg)' },
    ], { duration: 1200, easing: 'cubic-bezier(.16,1,.3,1)' }))
    host.current.querySelectorAll('.deck-ink-mote').forEach((mote, index) => {
      const angle = index * Math.PI / 4
      animations.push(mote.animate([
        { opacity: 0, transform: `translate(${Math.cos(angle) * 62}px,${Math.sin(angle) * 36}px) scale(.6)` },
        { opacity: .9, offset: .25 },
        { opacity: 0, transform: 'translate(0,0) scale(.3)' },
      ], { duration: 850, delay: index * 24, easing: 'cubic-bezier(.22,1,.36,1)' }))
    })
    return () => animations.forEach(animation => animation.cancel())
  }, [signature, inks.length])
  const known = inks.filter(ink => inkStyle[ink])
  const label = known.map(ink => inkStyle[ink].name).join(' + ')
  return <div ref={host} className={`deck-ink-crest${known.length > 1 ? ' combined' : ''}${invalid ? ' invalid' : ''}`} role="img" aria-label={label ? `Tintas: ${label}${invalid ? '. Combinación no válida' : ''}` : 'Sin tinta: añade tu primera carta'} title={label || 'Tu tinta se formará aquí'} style={{ '--crest-a': inkStyle[known[0]]?.color ?? '#9856cf', '--crest-b': inkStyle[known[1]]?.color ?? inkStyle[known[0]]?.color ?? '#329be0' } as CSSProperties}>
    <div className="deck-ink-fusion" aria-hidden="true" />
    {Array.from({ length: 8 }, (_, index) => <i className="deck-ink-mote" key={index} aria-hidden="true" />)}
    <div className="deck-ink-seals">
      {known.map(ink => <span key={ink} data-ink={ink} className={`deck-ink-seal${baseInks.includes(ink) ? '' : ' guest'}`} style={{ '--seal-color': inkStyle[ink].color } as CSSProperties}>
        <img src={`${import.meta.env.BASE_URL}ink-icons/${ink.toLowerCase()}.png`} alt="" /><i aria-hidden="true" />
        {Array.from({ length: 4 }, (_, index) => <img key={index} className={`deck-ink-fragment fragment-${index}`} src={`${import.meta.env.BASE_URL}ink-icons/${ink.toLowerCase()}.png`} alt="" aria-hidden="true" />)}
      </span>)}
      {!known.length && <span className="deck-ink-unformed" aria-hidden="true">✦</span>}
    </div>
  </div>
}
