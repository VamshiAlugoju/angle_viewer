import { useEffect, useState } from 'react'
import { api, type Instrument } from '../api/client'

const EXCHANGES = ['NSE', 'BSE', 'NFO', 'MCX', 'CDS']

export function InstrumentSearch({
  selected,
  onSelect,
  title = 'Instruments',
  fixedExchange,
  instrumentTypeFilter,
  placeholder = 'Search symbol or name (e.g. RELIANCE, NIFTY)',
  showPopularIndices = true,
}: {
  selected: Instrument | null
  onSelect: (instrument: Instrument) => void
  title?: string
  fixedExchange?: string
  instrumentTypeFilter?: string
  placeholder?: string
  showPopularIndices?: boolean
}) {
  const [query, setQuery] = useState('')
  const [exchange, setExchange] = useState(fixedExchange ?? 'NSE')
  const [results, setResults] = useState<Instrument[]>([])
  const [indices, setIndices] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (showPopularIndices) api.indices().then(setIndices).catch(() => {})
  }, [showPopularIndices])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      setLoading(true)
      api
        .searchInstruments(query, exchange, instrumentTypeFilter)
        .then(setResults)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [query, exchange, instrumentTypeFilter])

  return (
    <div className="card">
      <h2>{title}</h2>

      <div className="search-row">
        {!fixedExchange && (
          <select value={exchange} onChange={(e) => setExchange(e.target.value)}>
            {EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        )}
        <input placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}

      {results.length > 0 && (
        <ul className="instrument-list">
          {results.map((i) => (
            <li key={`${i.exch_seg}-${i.token}`}>
              <button type="button" onClick={() => onSelect(i)}>
                <strong>{i.symbol}</strong> <span className="muted">{i.name}</span>
                <span className="tag">{i.exch_seg}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!query && showPopularIndices && indices.length > 0 && (
        <>
          <h3>Popular Indices</h3>
          <ul className="instrument-list">
            {indices.slice(0, 15).map((i) => (
              <li key={`${i.exch_seg}-${i.token}`}>
                <button type="button" onClick={() => onSelect(i)}>
                  <strong>{i.symbol}</strong> <span className="muted">{i.name}</span>
                  <span className="tag">{i.exch_seg}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && (
        <p className="selected-instrument">
          Selected: <strong>{selected.symbol}</strong> ({selected.exch_seg}, token {selected.token})
        </p>
      )}
    </div>
  )
}
