import { useEffect, useRef, useState } from 'react'
import { connectLiveFeed, type Tick } from '../api/liveFeed'
import type { Instrument } from '../api/client'

const EXCHANGE_TYPE: Record<string, number> = {
  NSE: 1,
  NFO: 2,
  BSE: 3,
  BFO: 4,
  MCX: 5,
  NCDEX: 7,
  CDS: 13,
}

export function LiveTicker({ instrument }: { instrument: Instrument | null }) {
  const [status, setStatus] = useState('idle')
  const [tick, setTick] = useState<Tick | null>(null)
  const feedRef = useRef<ReturnType<typeof connectLiveFeed> | null>(null)

  useEffect(() => {
    const feed = connectLiveFeed(setTick, setStatus)
    feedRef.current = feed
    return () => feed.close()
  }, [])

  useEffect(() => {
    if (!instrument) return
    const exchangeType = EXCHANGE_TYPE[instrument.exch_seg]
    if (!exchangeType) return
    setTick(null)
    feedRef.current?.subscribe({ exchangeType, tokens: [instrument.token], mode: 1 })
    return () => feedRef.current?.unsubscribe({ exchangeType, tokens: [instrument.token], mode: 1 })
  }, [instrument])

  return (
    <div className="card">
      <h2>Live Ticker</h2>
      <p className="muted">Feed status: {status}</p>
      {!instrument && <p className="muted">Select an instrument to subscribe.</p>}
      {instrument && (
        <div className="ticker">
          <strong>{instrument.symbol}</strong>
          <span className="ltp">
            {tick ? (Number(tick.last_traded_price) / 100).toFixed(2) : '—'}
          </span>
          {tick && <span className="muted">seq {tick.sequence_number}</span>}
        </div>
      )}
    </div>
  )
}
