import { useState, type FormEvent } from 'react'
import { api } from '../api/client'

export function LoginForm({ onLoggedIn }: { onLoggedIn: (clientCode: string) => void }) {
  const [apiKey, setApiKey] = useState('')
  const [clientCode, setClientCode] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.login({ apiKey, clientCode, password, totp })
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
      <p className="muted">Credentials go straight to your local backend, never stored client-side.</p>

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
