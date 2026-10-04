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
        {progress > 0 && <span className="liquid-progress-stream">
          {[0, 1, 2].map(orbit => <span key={orbit} className="liquid-progress-current" style={{ '--orbit-offset': `${-orbit * 1.4}s` } as CSSProperties}>
            <svg viewBox="0 0 14 15" focusable="false">
              <path className="orbit-back" d="M9 1C2 1 0 14 5 14" />
              <path className="orbit-front" d="M5 14C12 14 14 1 9 1" />
            </svg>
          </span>)}
        </span>}
      </span>
    </span>
    <span><em>{label}</em><strong>{progress}%</strong></span>
  </span>
}
