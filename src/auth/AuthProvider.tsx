import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getProfile } from '../cloud/staffRepository'
import { errorMessage, requireSupabase, supabase } from '../lib/supabase'
import type { UserProfile } from '../types/staff'
import { AuthContext } from './authContext'
import { clearLocalAccess } from '../db/localAccess'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let alive = true
    let generation = 0
    let received = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      const current = ++generation
      received = true
      clearLocalAccess()
      setSession(next); setProfile(null); setError(''); setLoading(Boolean(next))
      // Keep the auth callback synchronous: profile requests run outside the auth lock.
      if (next) setTimeout(() => {
        getProfile(next.user.id).then(value => { if (alive && current === generation) setProfile(value) })
          .catch(reason => { if (alive && current === generation) setError(errorMessage(reason)) })
          .finally(() => { if (alive && current === generation) setLoading(false) })
      }, 0)
    })
    const timeout = setTimeout(() => { if (alive && !received) { setLoading(false); setError('Sessione non disponibile. Riprova ad accedere.') } }, 20000)
    return () => { alive = false; clearTimeout(timeout); subscription.unsubscribe() }
  }, [])
  const signIn = async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.status === 400 ? 'Email o password non corrette.' : errorMessage(error))
  }
  const signOut = async () => {
    clearLocalAccess(); setSession(null); setProfile(null)
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
    if (error) setError(errorMessage(error))
  }
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, profile, loading, error, isAuthenticated: Boolean(session && profile), signIn, signOut }}>{children}</AuthContext.Provider>
}
