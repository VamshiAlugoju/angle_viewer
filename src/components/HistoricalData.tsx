import { useState } from 'react'
import { api, type CandlePoint, type Instrument } from '../api/client'

const INTERVALS = [
  'ONE_MINUTE',
  'THREE_MINUTE',
  'FIVE_MINUTE',
  'TEN_MINUTE',
  'FIFTEEN_MINUTE',
  'THIRTY_MINUTE',
  'ONE_HOUR',
  'ONE_DAY',
]

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function Sparkline({ candles }: { candles: CandlePoint[] }) {
  if (candles.length < 2) return null
  const closes = candles.map((c) => c[4])
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const width = 600
  const height = 120
  const points = closes
    .map((c, i) => {
      const x = (i / (closes.length - 1)) * width
      const y = height - ((c - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  )
}

export function HistoricalData({ instrument }: { instrument: Instrument | null }) {
  const [interval, setInterval] = useState('ONE_DAY')
  const [fromdate, setFromdate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toDatetimeLocal(d)
  })
  const [todate, setTodate] = useState(() => toDatetimeLocal(new Date()))
  const [candles, setCandles] = useState<CandlePoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchData() {
    if (!instrument) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.candleData({
        exchange: instrument.exch_seg,
        symboltoken: instrument.token,
        interval,
        fromdate,
        todate,
      })
      if (!res.status) throw new Error('Failed to fetch candle data')
      setCandles(res.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch candle data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Historical Data</h2>
      {!instrument && <p className="muted">Select an instrument to load candle data.</p>}

      {instrument && (
        <>
          <div className="hist-controls">
            <select value={interval} onChange={(e) => setInterval(e.target.value)}>
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <input value={fromdate} onChange={(e) => setFromdate(e.target.value)} placeholder="YYYY-MM-DD HH:mm" />
            <input value={todate} onChange={(e) => setTodate(e.target.value)} placeholder="YYYY-MM-DD HH:mm" />
            <button type="button" onClick={fetchData} disabled={loading}>
              {loading ? 'Loading…' : 'Fetch'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {candles.length > 0 && (
            <>
              <Sparkline candles={candles} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candles
                      .slice()
                      .reverse()
                      .map((c) => (
                        <tr key={c[0]}>
                          <td>{new Date(c[0]).toLocaleString()}</td>
                          <td>{c[1]}</td>
                          <td>{c[2]}</td>
                          <td>{c[3]}</td>
                          <td>{c[4]}</td>
                          <td>{c[5]}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
