import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { GoalkeepersPage } from './pages/GoalkeepersPage'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { MatchesPage } from './pages/MatchesPage'
import { NotesPage } from './pages/NotesPage'
import { PlayerDetailPage } from './pages/PlayerDetailPage'
import { PlayersPage } from './pages/PlayersPage'
import { TodayPage } from './pages/TodayPage'
import { TrainingPage } from './pages/TrainingPage'
import { TrainingSessionDetailPage } from './pages/TrainingSessionDetailPage'

import { AuthProvider } from './auth/AuthProvider'
import { GroupProvider } from './groups/GroupProvider'
import { ProtectedRoute, GroupAccessGuard, LocalDataGuard, PermissionGuard } from './auth/Guards'
import { LoginPage, GroupSelectorPage } from './pages/AccessPages'
import { PublicHome } from './pages/PublicHome'
import { StaffPage } from './pages/StaffPage'
import { AdminPage } from './pages/AdminPage'
import { UiLabPage } from './pages/UiLabPage'
import { Navigate } from 'react-router-dom'

function App() {
  return <BrowserRouter><AuthProvider><GroupProvider><Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/app/groups" element={<GroupSelectorPage />} />
      <Route path="/app/ui-lab" element={<UiLabPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/app/:groupId" element={<GroupAccessGuard />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="staff" element={<PermissionGuard permission="staff.view"><StaffPage /></PermissionGuard>} />
          <Route element={<LocalDataGuard />}>
            <Route path="today" element={<PermissionGuard permission="training.view"><TodayPage /></PermissionGuard>} />
            <Route path="players" element={<PermissionGuard permission="players.view"><PlayersPage /></PermissionGuard>} />
            <Route path="players/:id" element={<PermissionGuard permission="players.view"><PlayerDetailPage /></PermissionGuard>} />
            <Route path="matches" element={<PermissionGuard permission="matches.view"><MatchesPage /></PermissionGuard>} />
            <Route path="matches/:id" element={<PermissionGuard permission="matches.view"><MatchDetailPage /></PermissionGuard>} />
            <Route path="goalkeepers" element={<PermissionGuard permission="players.view"><GoalkeepersPage /></PermissionGuard>} />
            <Route path="notes" element={<PermissionGuard permission="notes.view"><NotesPage /></PermissionGuard>} />
            <Route path="training" element={<PermissionGuard permission="training.view"><TrainingPage /></PermissionGuard>} />
            <Route path="training/:id" element={<PermissionGuard permission="training.view"><TrainingSessionDetailPage /></PermissionGuard>} />
          </Route>
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/app/groups" replace />} />
  </Routes></GroupProvider></AuthProvider></BrowserRouter>
}
export default App
