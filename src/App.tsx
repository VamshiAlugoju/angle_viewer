import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { api, type SessionTokens } from './api/client'
import { LoginForm } from './components/LoginForm'
import { Home } from './pages/Home'
import { DemoTrade } from './pages/DemoTrade'
import { Profile } from './pages/Profile'
import { Positions } from './pages/Positions'
import { clearSession, isExpired, loadSession, saveSession } from './auth'
import { usePositions } from './usePositions'
import './App.css'

function App() {
  const [clientCode, setClientCode] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const positions = usePositions(!!clientCode)

  useEffect(() => {
    const stored = loadSession()
    if (!stored) {
      setCheckingSession(false)
      return
    }

    // Jwt still valid (per its own exp claim) — try to rehydrate the server's
    // in-memory session with it (handles the common case of a server restart).
    const attempt = isExpired(stored)
      ? api.refreshSession(stored) // jwt expired — exchange the refresh token for a new one
      : api.restoreSession(stored)

    attempt
      .then((tokens) => {
        saveSession(tokens)
        setClientCode(tokens.clientCode)
      })
      .catch(() => clearSession())
      .finally(() => setCheckingSession(false))
  }, [])

  function handleLoggedIn(tokens: SessionTokens) {
    saveSession(tokens)
    setClientCode(tokens.clientCode)
  }

  async function handleLogout() {
    await api.logout()
    clearSession()
    setClientCode(null)
  }

  if (checkingSession) return null

  if (!clientCode) {
    return (
      <div className="app-shell centered">
        <LoginForm onLoggedIn={handleLoggedIn} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>SmartAPI Dashboard</h1>
        <div className="topbar-right">
          <span className="muted">{clientCode}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/demo_trade" className={({ isActive }) => (isActive ? 'active' : '')}>
          Demo Trade
        </NavLink>
        <NavLink to="/positions" className={({ isActive }) => (isActive ? 'active' : '')}>
          Positions
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          Profile
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo_trade" element={<DemoTrade positions={positions} />} />
        <Route path="/positions" element={<Positions positions={positions} />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  )
}

export default App
