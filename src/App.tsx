import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LoadingScreen } from './components/LoadingScreen'
import { initializeDatabase } from './db/db'
import { GoalkeepersPage } from './pages/GoalkeepersPage'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { MatchesPage } from './pages/MatchesPage'
import { NotesPage } from './pages/NotesPage'
import { PlayerDetailPage } from './pages/PlayerDetailPage'
import { PlayersPage } from './pages/PlayersPage'
import { TodayPage } from './pages/TodayPage'
import { TrainingPage } from './pages/TrainingPage'
import { TrainingSessionDetailPage } from './pages/TrainingSessionDetailPage'

function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch(() => setError('Non riesco ad aprire il database locale. Controlla spazio disponibile o modalità privata.'))
  }, [])

  if (error) {
    return (
      <div className="loading-screen error-screen">
        <strong>Coach Field</strong>
        <p>{error}</p>
      </div>
    )
  }

  if (!ready) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<PlayerDetailPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/goalkeepers" element={<GoalkeepersPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/training/:id" element={<TrainingSessionDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
