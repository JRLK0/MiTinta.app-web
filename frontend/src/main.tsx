import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeBackend } from './supabase'
import './styles.css'

import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
void initializeBackend()
