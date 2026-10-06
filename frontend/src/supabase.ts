import { createClient } from '@supabase/supabase-js'
import { readAuthCallback } from './authCallback'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const isConfigured = Boolean(url && publishableKey)
// Capture before createClient: URL detection may finish before React subscribes.
export const initialAuthCallback = readAuthCallback(typeof window === 'undefined' ? '' : window.location.hash)
export const supabase = createClient(
  url || 'https://example.supabase.co',
  publishableKey || 'not-configured',
)
