import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
function createConfiguredClient() {
  if (!url || !key) return null
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(15000)]) }) } })
  } catch { return null }
}
export const supabase = createConfiguredClient()
export function requireSupabase() {
  if (!supabase) throw new Error('Supabase non configurato: impostare VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  return supabase
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Operazione non riuscita. Verifica la connessione.' }
