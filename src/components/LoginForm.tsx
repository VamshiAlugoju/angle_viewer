import { useState, type FormEvent } from 'react'
import { api } from '../api/client'

const STORAGE_KEY = 'smartapi.loginDetails'

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function LoginForm({ onLoggedIn }: { onLoggedIn: (clientCode: string) => void }) {
  const saved = loadSaved()
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [clientCode, setClientCode] = useState(saved?.clientCode ?? '')
  const [password, setPassword] = useState(saved?.password ?? '')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.login({ apiKey, clientCode, password, totp })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, clientCode, password }))
      onLoggedIn(res.clientCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h1>SmartAPI Login</h1>
      <p className="muted">Credentials sent to your local backend. Saved in browser storage except TOTP.</p>

      <label>
        API Key
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
      </label>
      <label>
        Client Code
        <input value={clientCode} onChange={(e) => setClientCode(e.target.value)} required />
      </label>
      <label>
        Password / PIN
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        TOTP (from authenticator app)
        <input value={totp} onChange={(e) => setTotp(e.target.value)} required inputMode="numeric" />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Logging in…' : 'Login'}
      </button>
    </form>
  )
}
