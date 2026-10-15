import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { MatchesPage } from './pages/MatchesPage'
import { PlayersPage } from './pages/PlayersPage'
import { TodayPage } from './pages/TodayPage'
import { TrainingPage } from './pages/TrainingPage'
import { TrainingImportPage } from './pages/TrainingImportPage'

import { AuthProvider } from './auth/AuthProvider'
import { GroupProvider } from './groups/GroupProvider'
import { ProtectedRoute, GroupAccessGuard, PermissionGuard } from './auth/Guards'
import { LoginPage } from './pages/AccessPages'
import { PublicHome } from './pages/PublicHome'
import { StaffPage } from './pages/StaffPage'
import { AdminPage } from './pages/AdminPage'
import { UiLabPage } from './pages/UiLabPage'
import { OrganizationHubPage } from './pages/OrganizationHubPage'
import { GroupHubPage } from './pages/GroupHubPage'
import { TeamHubPage } from './pages/TeamHubPage'
import { WorkGroupHubPage } from './pages/WorkGroupHubPage'
import { GroupSettingsPage } from './pages/GroupSettingsPage'
import { GroupDashboardPage } from './pages/GroupDashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage'
import { HierarchyShell } from './components/HierarchyShell'
import { Navigate, useParams } from 'react-router-dom'

function LegacyGroupRedirect({ to }: { to: string }) {
  const { groupId } = useParams()
  return <Navigate to={`/app/${groupId}/${to}`} replace />
}

function App() {
  return <BrowserRouter><AuthProvider><GroupProvider><Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<HierarchyShell />}>
        <Route path="/app/groups" element={<OrganizationHubPage />} />
        <Route path="/app/organizations/:organizationId" element={<GroupHubPage />} />
        <Route path="/app/organizations/:organizationId/seasons/:seasonId" element={<TeamHubPage />} />
        <Route path="/app/organizations/:organizationId/seasons/:seasonId/teams/:teamId" element={<WorkGroupHubPage />} />
      </Route>
      <Route path="/app/ui-lab" element={<UiLabPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/app/:groupId" element={<GroupAccessGuard />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="settings" element={<PermissionGuard permission="group.settings"><GroupSettingsPage /></PermissionGuard>} />
          <Route path="staff" element={<PermissionGuard permission="staff.view"><StaffPage /></PermissionGuard>} />
          <Route path="dashboard" element={<PermissionGuard permission="training.view"><GroupDashboardPage /></PermissionGuard>} />
          <Route path="calendar" element={<PermissionGuard permission="training.view"><CalendarPage /></PermissionGuard>} />
          <Route path="today" element={<PermissionGuard permission="training.view"><TodayPage /></PermissionGuard>} />
          <Route path="players" element={<PermissionGuard permission="players.view"><PlayersPage /></PermissionGuard>} />
          <Route path="training" element={<PermissionGuard permission="training.view"><TrainingPage /></PermissionGuard>} />
          <Route path="training-import" element={<PermissionGuard permission="training.edit"><TrainingImportPage /></PermissionGuard>} />
          <Route path="exercises" element={<PermissionGuard permission="templates.view"><ExerciseLibraryPage /></PermissionGuard>} />
          <Route path="players/:id" element={<LegacyGroupRedirect to="players" />} />
          <Route path="goalkeepers" element={<LegacyGroupRedirect to="players" />} />
          <Route path="notes" element={<LegacyGroupRedirect to="players" />} />
          <Route path="training/:id" element={<PermissionGuard permission="training.view"><TrainingPage /></PermissionGuard>} />
          <Route path="matches" element={<PermissionGuard permission="matches.view"><MatchesPage /></PermissionGuard>} />
          <Route path="matches/:id" element={<PermissionGuard permission="matches.view"><MatchDetailPage /></PermissionGuard>} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/app/groups" replace />} />
  </Routes></GroupProvider></AuthProvider></BrowserRouter>
}
export default App
