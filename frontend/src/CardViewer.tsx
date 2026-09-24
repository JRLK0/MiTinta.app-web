import { CSSProperties, PointerEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Gem, Move3D, Sparkles, X } from 'lucide-react'
import { FoilProfile, foilHasTopLayer, foilMaskUrls, foilProfileFor } from './foilEffect'
import { deviceTiltFromOrientation } from './cardMotion'
import { isFoilOnlyRarity } from './catalog'

export type ViewerCard = {
  id?: string
  name: string
  version: string
  imageUrl: string | null
  setCode?: string
  setName?: string
  collectorNumber?: string
  rarity?: string
  ink?: string | null
  normalPriceEur?: number | null
  foilPriceEur?: number | null
  normalQuantity?: number
  foilQuantity?: number
}

type CardViewerProps = {
  card: ViewerCard
  foil?: boolean
  canToggleFoil?: boolean
  printings?: ViewerCard[]
  onClose: () => void
}

type FoilMotion = { colorX: number; colorY: number; rotateX: number; rotateY: number; opacity: number; combined: number }
type MotionAccess = 'hidden' | 'checking' | 'prompt' | 'listening' | 'active' | 'touch'
type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const restingFoil: FoilMotion = { colorX: 50, colorY: 50, rotateX: 0, rotateY: 0, opacity: 0, combined: 100 }
const satinOverlayProfiles = new Set<FoilProfile>(['satin', 'free-form-2', 'glitter', 'calendar-wave', 'rainbow-pillars'])

function writeFoilMotion(element: HTMLElement, motion: FoilMotion) {
  element.style.setProperty('--color-x', `${motion.colorX}%`)
  element.style.setProperty('--color-y', `${motion.colorY}%`)
  element.style.setProperty('--rotate-x', `${motion.rotateX}deg`)
  element.style.setProperty('--rotate-y', `${motion.rotateY}deg`)
  element.style.setProperty('--foil-opacity', `${motion.opacity}`)
  element.style.setProperty('--combined', `${motion.combined}%`)
}

export function CardViewer({ card, foil = false, canToggleFoil = false, printings = [], onClose }: CardViewerProps) {
  const [activeCard, setActiveCard] = useState(card)
  const [foilMode, setFoilMode] = useState(foil)
  const [motionAccess, setMotionAccess] = useState<MotionAccess>('checking')
  const [orientationEnabled, setOrientationEnabled] = useState(false)
  const cardElement = useRef<HTMLDivElement | null>(null)
  const orientationBaseline = useRef<{ beta: number; gamma: number } | null>(null)
  const motion = useRef({
    current: { ...restingFoil },
    target: { ...restingFoil },
    velocity: { ...restingFoil, colorX: 0, colorY: 0, combined: 0 },
    frame: 0,
  })
  const rarityClass = (activeCard.rarity ?? '').toLocaleLowerCase('es').replace(/[^a-z]/g, '')
  const isSpecial = isFoilOnlyRarity(activeCard.rarity)
  const effectiveFoilMode = foilMode || isSpecial
  const hasFoilEffect = effectiveFoilMode
  const canShowFoil = canToggleFoil || activeCard.foilPriceEur != null
  const foilProfile = foilProfileFor(activeCard)
  const foilMasks = foilMaskUrls(activeCard)
  const hasTopLayer = foilHasTopLayer(activeCard)
  const processedTopMask = hasTopLayer && foilMasks
    ? `url("${import.meta.env.BASE_URL}foil-top-masks/${foilMasks.cardKey}.webp")`
    : undefined
  const hasSatinOverlay = satinOverlayProfiles.has(foilProfile)

  useEffect(() => {
    setActiveCard(card)
    setFoilMode(foil)
  }, [card, foil])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  useEffect(() => () => cancelAnimationFrame(motion.current.frame), [])

  useEffect(() => {
    cancelAnimationFrame(motion.current.frame)
    motion.current.current = { ...restingFoil }
    motion.current.target = { ...restingFoil }
    motion.current.velocity = { ...restingFoil, colorX: 0, colorY: 0, combined: 0 }
    if (cardElement.current) writeFoilMotion(cardElement.current, restingFoil)
  }, [activeCard.id, activeCard.setCode, activeCard.collectorNumber, foilMode])

  function animateFoil() {
    cancelAnimationFrame(motion.current.frame)
    const tick = () => {
      const element = cardElement.current
      if (!element) return
      let moving = false
      for (const key of Object.keys(restingFoil) as (keyof FoilMotion)[]) {
        const delta = motion.current.target[key] - motion.current.current[key]
        motion.current.velocity[key] = (motion.current.velocity[key] + delta * .04) * .7
        motion.current.current[key] += motion.current.velocity[key]
        if (Math.abs(delta) > .01 || Math.abs(motion.current.velocity[key]) > .01) moving = true
      }
      writeFoilMotion(element, motion.current.current)
      if (moving) motion.current.frame = requestAnimationFrame(tick)
    }
    motion.current.frame = requestAnimationFrame(tick)
  }

  function setTilt(horizontal: number, vertical: number) {
    const colorX = 50 + horizontal * 4
    const colorY = 30 + vertical * 3
    motion.current.target = {
      colorX,
      colorY,
      rotateX: -horizontal,
      rotateY: vertical / 1.5,
      opacity: .56,
      combined: colorX + colorY,
    }
    animateFoil()
  }

  useEffect(() => {
    orientationBaseline.current = null
    if (!hasFoilEffect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotionAccess('hidden')
      return
    }
    if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      setMotionAccess('hidden')
      return
    }

    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationConstructor | undefined
    if (!OrientationEvent) {
      setMotionAccess('touch')
      return
    }
    if (OrientationEvent.requestPermission && !orientationEnabled) {
      setMotionAccess('prompt')
      return
    }

    setMotionAccess('listening')
    const noSensorTimer = window.setTimeout(() => setMotionAccess((current) => current === 'listening' ? 'touch' : current), 1600)
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return
      if (!orientationBaseline.current) {
        orientationBaseline.current = { beta: event.beta, gamma: event.gamma }
        setMotionAccess('active')
        return
      }
      const legacyAngle = (window as Window & { orientation?: number }).orientation ?? 0
      const screenAngle = window.screen.orientation?.angle ?? legacyAngle
      const tilt = deviceTiltFromOrientation(
        event.beta,
        event.gamma,
        orientationBaseline.current.beta,
        orientationBaseline.current.gamma,
        screenAngle,
      )
      setTilt(tilt.horizontal, tilt.vertical)
      setMotionAccess('active')
    }
    const recalibrate = () => {
      orientationBaseline.current = null
      resetTilt()
    }

    window.addEventListener('deviceorientation', onOrientation)
    window.addEventListener('orientationchange', recalibrate)
    return () => {
      window.clearTimeout(noSensorTimer)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('orientationchange', recalibrate)
    }
  }, [hasFoilEffect, orientationEnabled, activeCard.id, activeCard.setCode, activeCard.collectorNumber])

  async function requestOrientation() {
    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationConstructor | undefined
    if (!OrientationEvent?.requestPermission) {
      setOrientationEnabled(true)
      return
    }
    try {
      const permission = await OrientationEvent.requestPermission()
      if (permission === 'granted') setOrientationEnabled(true)
      else setMotionAccess('touch')
    } catch {
      setMotionAccess('touch')
    }
  }

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!hasFoilEffect) return
    if (event.pointerType !== 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const horizontal = Math.max(-16, Math.min(16, (event.clientX - bounds.left - bounds.width / 2) / 8))
    const vertical = Math.max(-16, Math.min(16, (event.clientY - bounds.top - bounds.height / 2) / 8))
    setTilt(horizontal, vertical)
  }

  function resetTilt() {
    motion.current.target = { ...restingFoil }
    animateFoil()
  }

  const price = effectiveFoilMode ? activeCard.foilPriceEur : activeCard.normalPriceEur
  const tiltStyle = {
    '--rotate-x': '0deg',
    '--rotate-y': '0deg',
    '--color-x': '50%',
    '--color-y': '50%',
    '--combined': '100%',
    '--foil-opacity': '0',
  } as CSSProperties

  const maskId = foilMasks ? `foil-mask-${foilMasks.cardKey.replace(/[^a-zA-Z0-9-]/g, '-')}` : null
  const displayImageUrl = hasFoilEffect && foilMasks ? foilMasks.image : activeCard.imageUrl

  return createPortal(
    <div className="card-viewer-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="card-viewer" role="dialog" aria-modal="true" aria-label={`${activeCard.name}, ${activeCard.version}`}>
        <button className="viewer-close" onClick={onClose} title="Cerrar" aria-label="Cerrar" autoFocus><X /></button>
        <div className="viewer-stage">
          <div
            key={effectiveFoilMode ? 'foil' : 'normal'}
            ref={cardElement}
            className={`viewer-card${hasFoilEffect ? ` foil foil-${foilProfile}` : ''}${isSpecial ? ` special ${rarityClass}` : ''}`}
            style={tiltStyle}
            onPointerDown={(event) => {
              if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId)
              tilt(event)
            }}
            onPointerMove={tilt}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
              resetTilt()
            }}
            onPointerCancel={resetTilt}
            onPointerLeave={(event) => { if (event.pointerType === 'mouse') resetTilt() }}
          >
            {displayImageUrl ? <img
              src={displayImageUrl}
              alt={`${activeCard.name}, ${activeCard.version}`}
              onError={(event) => {
                if (activeCard.imageUrl && event.currentTarget.src !== activeCard.imageUrl) event.currentTarget.src = activeCard.imageUrl
              }}
            /> : <div className="viewer-placeholder"><Gem /></div>}
            {hasFoilEffect && foilMasks && maskId && <svg className="viewer-foil-defs" aria-hidden="true" focusable="false">
              <defs>
                <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" style={{ maskType: 'luminance' }}>
                  <image href={foilMasks.mask} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
                </mask>
              </defs>
            </svg>}
            {hasFoilEffect && <span className="viewer-foil-finish" aria-hidden="true">
              <span className="viewer-foil-shine"><span className="viewer-foil-inner" style={maskId ? { '--foil-mask': `url(#${maskId})` } as CSSProperties : undefined} /></span>
              {hasSatinOverlay && <span className="viewer-satin-shine"><span className="viewer-foil-inner" style={maskId ? { '--foil-mask': `url(#${maskId})` } as CSSProperties : undefined} /></span>}
              {foilProfile === 'lore' && <span className="viewer-lore-shine"><span className="viewer-foil-inner" style={maskId ? { '--foil-mask': `url(#${maskId})` } as CSSProperties : undefined} /></span>}
              <span className="viewer-foil-glare" />
              {processedTopMask && <span className="viewer-foil-top"><span className="viewer-foil-inner" style={{ '--top-mask': processedTopMask } as CSSProperties} /></span>}
            </span>}
          </div>
          {hasFoilEffect && <span className={`viewer-finish-caption ${rarityClass}`}><Sparkles />{isSpecial ? activeCard.rarity : 'Acabado foil'}</span>}
          {hasFoilEffect && motionAccess === 'prompt' && <button className="viewer-motion-hint action" onClick={requestOrientation}><Move3D />Activar movimiento</button>}
          {hasFoilEffect && motionAccess === 'listening' && <span className="viewer-motion-hint"><Move3D />Detectando movimiento…</span>}
          {hasFoilEffect && motionAccess === 'active' && <span className="viewer-motion-hint"><Move3D />Inclina el móvil</span>}
          {hasFoilEffect && motionAccess === 'touch' && <span className="viewer-motion-hint"><Move3D />Arrastra la carta para moverla</span>}
        </div>
        <div className="viewer-details">
          <p className="eyebrow">{activeCard.setCode ? `${activeCard.setCode} · #${activeCard.collectorNumber}` : 'Lorcana'}</p>
          <h2>{activeCard.name}</h2>
          <p className="viewer-version">{activeCard.version}</p>
          {((activeCard.normalQuantity ?? 0) > 0 || (activeCard.foilQuantity ?? 0) > 0) && <div className="viewer-ownership" aria-label="Copias en tu colección">
            <span><small>Normal</small><b>×{activeCard.normalQuantity ?? 0}</b></span>
            <span className="foil"><Gem aria-hidden="true" /><small>Foil</small><b>×{activeCard.foilQuantity ?? 0}</b></span>
          </div>}
          {printings.length > 1 && <div className="viewer-printings">
            <span>Impresiones</span>
            <div>{printings.map((printing) => {
              const active = (printing.id && printing.id === activeCard.id) || (!printing.id && printing.setCode === activeCard.setCode && printing.collectorNumber === activeCard.collectorNumber)
              return <button
                key={printing.id ?? `${printing.setCode}-${printing.collectorNumber}`}
                className={active ? 'active' : ''}
                onClick={() => setActiveCard(printing)}
                onPointerEnter={(event) => { if (event.pointerType === 'mouse') setActiveCard(printing) }}
                onFocus={() => setActiveCard(printing)}
                aria-pressed={active}
                title={`${printing.setCode} · ${printing.setName ?? 'Lorcana'} · #${printing.collectorNumber}`}
              >
                {printing.imageUrl && <img src={printing.imageUrl} alt="" />}
                <span><b>{printing.setCode}</b><small>#{printing.collectorNumber}</small></span>
              </button>
            })}</div>
            <small>Pasa el ratón o toca una opción para cambiar la imagen.</small>
          </div>}
          {canShowFoil && !isSpecial && <div className="viewer-finish segmented" aria-label="Acabado mostrado">
            <button className={!foilMode ? 'active' : ''} onClick={() => setFoilMode(false)}>Normal</button>
            <button className={foilMode ? 'active' : ''} onClick={() => setFoilMode(true)}><Gem />Foil</button>
          </div>}
          <div className="viewer-meta">
            {activeCard.rarity && <span>{activeCard.rarity}</span>}
            {activeCard.ink && <span>{activeCard.ink}</span>}
          </div>
          <strong className="viewer-price">{price == null ? 'Sin precio' : price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
        </div>
      </section>
    </div>,
    document.body,
  )
}
