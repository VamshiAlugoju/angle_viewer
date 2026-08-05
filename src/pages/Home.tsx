import { useState } from 'react'
import type { Instrument } from '../api/client'
import { InstrumentSearch } from '../components/InstrumentSearch'
import { OptionsChain } from '../components/OptionsChain'
import { HistoricalData } from '../components/HistoricalData'
import { LiveTicker } from '../components/LiveTicker'

type SubTab = 'equity' | 'options'

export function Home() {
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [selectedOption, setSelectedOption] = useState<Instrument | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('equity')

  return (
    <>
      <nav className="tabs">
        <button type="button" className={subTab === 'equity' ? 'active' : ''} onClick={() => setSubTab('equity')}>
          Equity
        </button>
        <button type="button" className={subTab === 'options' ? 'active' : ''} onClick={() => setSubTab('options')}>
          Options
        </button>
      </nav>

      {subTab === 'equity' && (
        <>
          <div className="card-row">
            <InstrumentSearch selected={selectedInstrument} onSelect={setSelectedInstrument} />
            <LiveTicker instrument={selectedInstrument} />
          </div>
          <HistoricalData instrument={selectedInstrument} />
        </>
      )}

      {subTab === 'options' && (
        <>
          <OptionsChain selected={selectedOption} onSelect={setSelectedOption} />
          <HistoricalData instrument={selectedOption} />
        </>
      )}
    </>
  )
}
