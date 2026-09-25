import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { resolvePermissions } from '../auth/permissions'
import { loadStaffContext, type StaffContextData } from '../cloud/staffRepository'
import { clearLocalAccess } from '../db/localAccess'
import { errorMessage } from '../lib/supabase'
import { groupRole } from './access'
import { GroupContext } from './groupContext'
const empty: StaffContextData = { organizations: [], groups: [], organizationMemberships: [], memberships: [], overrides: [] }
export function GroupProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [state, setState] = useState({ data: empty, owner: '', loading: false, error: '' })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const userId = isAuthenticated ? user?.id ?? '' : ''
  const generation = useRef(0)
  const reload = useCallback(async () => {
    clearLocalAccess()
    const request = ++generation.current
    if (!userId) return
    setState({ data: empty, owner: userId, loading: true, error: '' })
    try { const data = await loadStaffContext(); if (request === generation.current) setState({ data, owner: userId, loading: false, error: '' }) }
    catch (error) { if (request === generation.current) setState({ data: empty, owner: userId, loading: false, error: errorMessage(error) }) }
  }, [userId])
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer) }, [reload])
  const data = state.owner === userId && userId ? state.data : empty
  const availableGroups = data.groups.filter(group => groupRole(data, userId, group))
  const groupId = pathname.match(/^\/app\/([^/]+)/)?.[1]
  const activeGroup = availableGroups.find(group => group.id === groupId)
  const role = activeGroup ? groupRole(data, userId, activeGroup) : undefined
  const membership = data.memberships.find(item => item.groupId === activeGroup?.id && item.userId === userId && item.active)
  const permissions = resolvePermissions({ role, overrides: data.overrides.filter(item => item.membershipId === membership?.id) })
  return <GroupContext.Provider value={{ data, loading: Boolean(userId) && (state.owner !== userId || state.loading), error: state.error, availableGroups, activeGroup, membership, role, permissions, reload,
    switchGroup: id => { clearLocalAccess(); navigate(`/app/${id}/today`) },
  }}>{children}</GroupContext.Provider>
}
