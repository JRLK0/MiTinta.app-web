import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  useEffect(() => {
    const update = () => setDark(document.documentElement.dataset.theme === 'dark')
    window.addEventListener('mitinta-theme-change', update)
    return () => window.removeEventListener('mitinta-theme-change', update)
  }, [])
  return <button type="button" className="theme-toggle" data-theme-toggle aria-label="Tema oscuro" aria-pressed={dark} title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
    <span className="theme-dark-label"><Moon aria-hidden="true" /><span className="theme-label">Oscuro</span></span>
    <span className="theme-light-label"><Sun aria-hidden="true" /><span className="theme-label">Claro</span></span>
  </button>
}
