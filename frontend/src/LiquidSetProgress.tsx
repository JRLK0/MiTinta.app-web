import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './liquidSetProgress.css'

export function LiquidSetProgress({ value, label, variant, phase }: {
  value: number
  label: string
  variant: 'primary' | 'master'
  phase: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(!document.hidden)
  const progress = Math.min(100, Math.max(0, value))

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(element)
    const onVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return <span ref={ref} className={`set-progress ${variant} liquid-progress${visible && pageVisible && progress > 0 ? ' flowing' : ''}`} style={{ '--ink-phase': `${-phase * 0.73}s` } as CSSProperties}>
    <span className="liquid-progress-track" aria-hidden="true">
      <span className="liquid-progress-fill" style={{ width: `${progress}%` }} />
      {progress > 0 && [0, 1, 2].map(orbit => <span key={orbit} className="liquid-progress-orbit" style={{ '--orbit-offset': `${-orbit * 1.6}s`, left: `${20 + orbit * 30}%` } as CSSProperties}>
        <svg viewBox="0 0 20 20" focusable="false">
          <path className="orbit-back" d="M10 2a8 8 0 0 0 0 16" />
          <path className="orbit-front" d="M10 18a8 8 0 0 0 0-16" />
          <circle className="liquid-progress-orbit-trail" cx="10" cy="10" r="8" />
        </svg>
        <span className="liquid-progress-orbit-light" />
      </span>)}
    </span>
    <span><em>{label}</em><strong>{progress}%</strong></span>
  </span>
}
