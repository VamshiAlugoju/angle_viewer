import { useState } from 'react'
import { api, type CandlePoint, type Instrument } from '../api/client'
import { PremiumChart } from './PremiumChart'

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

function apiToInputValue(apiDate: string) {
  return apiDate.replace(' ', 'T')
}

function inputToApiValue(inputDate: string) {
  return inputDate.replace('T', ' ')
}

function istDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

const MARKET_OPEN = '09:15'
const MARKET_CLOSE = '15:30'

function downloadCsv(candles: CandlePoint[], instrument: Instrument, interval: string) {
  const meta = `Interval,${interval}\n`
  const header = 'Time,Open,High,Low,Close,Volume\n'
  const rows = candles
    .map((c) => [new Date(c[0]).toISOString(), c[1], c[2], c[3], c[4], c[5]].join(','))
    .join('\n')
  const blob = new Blob([meta + header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${instrument.symbol}_${instrument.token}_${interval}_candles.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoricalData({ instrument }: { instrument: Instrument | null }) {
  const [interval, setInterval] = useState('ONE_DAY')
  const [fromdate, setFromdate] = useState(() => `${istDateStr()} ${MARKET_OPEN}`)
  const [todate, setTodate] = useState(() => `${istDateStr()} ${MARKET_CLOSE}`)
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
            <input
              type="datetime-local"
              value={apiToInputValue(fromdate)}
              onChange={(e) => setFromdate(inputToApiValue(e.target.value))}
            />
            <input
              type="datetime-local"
              value={apiToInputValue(todate)}
              onChange={(e) => setTodate(inputToApiValue(e.target.value))}
            />
            <button type="button" onClick={fetchData} disabled={loading}>
              {loading ? 'Loading…' : 'Fetch'}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(candles, instrument, interval)}
              disabled={candles.length === 0}
            >
              Download CSV
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {candles.length > 0 && (
            <>
              <PremiumChart candles={candles} />
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
