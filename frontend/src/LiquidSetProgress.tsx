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
      <span className="liquid-progress-fill" style={{ width: `${progress}%` }}>
        {[0, 1, 2].map(orbit => <span key={orbit} className="liquid-progress-orbit" style={{ '--orbit-offset': `${-orbit * 2.4}s` } as CSSProperties}>
          <svg viewBox="0 0 240 16" preserveAspectRatio="none" focusable="false">
            <path d="M-30 8 C0 8 10 2 40 2 S80 14 110 14 S150 2 180 2 S220 14 250 14 S290 8 320 8" />
          </svg>
        </span>)}
      </span>
    </span>
    <span><em>{label}</em><strong>{progress}%</strong></span>
  </span>
}
