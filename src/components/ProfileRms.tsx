import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function ProfileRms() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [rms, setRms] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.profile(), api.rms()])
      .then(([p, r]) => {
        setProfile(p.data)
        setRms(r.data)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="error">{error}</p>

  return (
    <div className="card-row">
      <div className="card">
        <h2>Profile</h2>
        {profile ? (
          <dl>
            <dt>Name</dt>
            <dd>{String(profile.name ?? '—')}</dd>
            <dt>Client Code</dt>
            <dd>{String(profile.clientcode ?? '—')}</dd>
            <dt>Email</dt>
            <dd>{String(profile.email ?? '—')}</dd>
            <dt>Exchanges</dt>
            <dd>{Array.isArray(profile.exchanges) ? profile.exchanges.join(', ') : '—'}</dd>
            <dt>Products</dt>
            <dd>{Array.isArray(profile.products) ? profile.products.join(', ') : '—'}</dd>
          </dl>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      <div className="card">
        <h2>RMS / Funds</h2>
        {rms ? (
          <dl>
            <dt>Net</dt>
            <dd>{String(rms.net ?? '—')}</dd>
            <dt>Available Cash</dt>
            <dd>{String(rms.availablecash ?? '—')}</dd>
            <dt>Available Intraday Payin</dt>
            <dd>{String(rms.availableintradaypayin ?? '—')}</dd>
            <dt>Collateral</dt>
            <dd>{String(rms.collateral ?? '—')}</dd>
            <dt>M2M Unrealised</dt>
            <dd>{String(rms.m2munrealized ?? '—')}</dd>
          </dl>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    </div>
  )
}
