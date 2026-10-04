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
  const progress = Math.min(100, Math.max(0, value))

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <span ref={ref} className={`set-progress ${variant} liquid-progress${visible && progress > 0 ? ' flowing' : ''}`} style={{ '--ink-phase': `${-phase * 0.73}s` } as CSSProperties}>
    <span className="liquid-progress-track" aria-hidden="true">
      <span className="liquid-progress-fill" style={{ width: `${progress}%` }}>
        <span className="liquid-progress-current back" />
        <span className="liquid-progress-current front" />
      </span>
    </span>
    <span><em>{label}</em><strong>{progress}%</strong></span>
  </span>
}
