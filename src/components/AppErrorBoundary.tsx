import { Component, type ReactNode } from 'react'
import { APP_NAME } from '../brand'
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <main className="page"><h1>{APP_NAME}</h1><p role="alert">Impossibile aprire questa schermata. I dati locali non sono stati cancellati.</p><button onClick={() => window.location.reload()}>Riprova</button><a href="/app/groups">Torna ai gruppi</a></main> : this.props.children
  }
}
