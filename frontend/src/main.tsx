import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeBackend } from './supabase'
import './styles.css'

async function start() {
  await initializeBackend()
  const { default: App } = await import('./App')
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
}
void start().catch((error: unknown) => {
  const root = document.getElementById('root')!
  const message = document.createElement('p')
  message.textContent = error instanceof Error ? error.message : 'No se pudo verificar la conexión.'
  const retry = document.createElement('button')
  retry.textContent = 'Volver a intentar'
  retry.onclick = () => window.location.reload()
  root.replaceChildren(message, retry)
})
