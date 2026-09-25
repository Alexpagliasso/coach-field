import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/themes.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './ThemeProvider.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
