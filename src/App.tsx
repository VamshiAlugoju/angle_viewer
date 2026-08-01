import { useEffect, useState } from 'react'
import { api, type Instrument } from './api/client'
import { LoginForm } from './components/LoginForm'
import { ProfileRms } from './components/ProfileRms'
import { InstrumentSearch } from './components/InstrumentSearch'
import { HistoricalData } from './components/HistoricalData'
import { LiveTicker } from './components/LiveTicker'
import './App.css'

type Tab = 'equity' | 'options'

function App() {
  const [clientCode, setClientCode] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [selectedOption, setSelectedOption] = useState<Instrument | null>(null)
  const [tab, setTab] = useState<Tab>('equity')

  useEffect(() => {
    api
      .session()
      .then((s) => setClientCode(s.clientCode))
      .finally(() => setCheckingSession(false))
  }, [])

  async function handleLogout() {
    await api.logout()
    setClientCode(null)
    setSelectedInstrument(null)
  }

  if (checkingSession) return null

  if (!clientCode) {
    return (
      <div className="app-shell centered">
        <LoginForm onLoggedIn={setClientCode} />
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

      <ProfileRms />

      <nav className="tabs">
        <button type="button" className={tab === 'equity' ? 'active' : ''} onClick={() => setTab('equity')}>
          Equity
        </button>
        <button type="button" className={tab === 'options' ? 'active' : ''} onClick={() => setTab('options')}>
          Options
        </button>
      </nav>

      {tab === 'equity' && (
        <>
          <div className="card-row">
            <InstrumentSearch selected={selectedInstrument} onSelect={setSelectedInstrument} />
            <LiveTicker instrument={selectedInstrument} />
          </div>
          <HistoricalData instrument={selectedInstrument} />
        </>
      )}

      {tab === 'options' && (
        <>
          <InstrumentSearch
            title="Options Instruments"
            selected={selectedOption}
            onSelect={setSelectedOption}
            fixedExchange="NFO"
            instrumentTypeFilter="OPTSTK,OPTIDX"
            placeholder="Search option contract (e.g. NIFTY, BANKNIFTY, RELIANCE)"
            showPopularIndices={false}
          />
          <HistoricalData instrument={selectedOption} />
        </>
      )}
    </div>
  )
}

export default App
