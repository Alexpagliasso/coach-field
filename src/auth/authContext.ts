import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile } from '../types/staff'
export type AuthState = { user: User | null; session: Session | null; profile: UserProfile | null; loading: boolean; error: string; isAuthenticated: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void> }
export const AuthContext = createContext<AuthState | undefined>(undefined)
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider mancante'); return value }
