import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const isConfigured = Boolean(url && publishableKey)
export const supabase = createClient(
  url || 'https://example.supabase.co',
  publishableKey || 'not-configured',
)
