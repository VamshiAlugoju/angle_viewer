export interface LoginPayload {
  apiKey: string
  clientCode: string
  password: string
  totp: string
}

export interface SessionTokens {
  clientCode: string
  apiKey: string
  jwtToken: string
  refreshToken: string
  feedToken: string
}

export interface Instrument {
  token: string
  symbol: string
  name: string
  exch_seg: string
  instrumenttype: string
  lotsize: string
  tick_size: string
  expiry?: string
  strike?: string
  expiryType?: 'WEEKLY' | 'MONTHLY'
  optionType?: 'CE' | 'PE' | ''
}

export interface QuoteRow {
  exchange: string
  tradingSymbol: string
  symbolToken: string
  ltp: number
  open?: number
  high?: number
  low?: number
  close?: number
  netChange?: number
  percentChange?: number
  tradeVolume?: number
  opnInterest?: number
}

export interface GreekRow {
  name: string
  expiry: string
  strikePrice: string
  optionType: 'CE' | 'PE'
  delta: string
  gamma: string
  theta: string
  vega: string
  impliedVolatility: string
  tradeVolume?: string
}

export interface PositionContract {
  token: string
  symbol: string
  exch_seg: string
  name: string
  optionType: 'CE' | 'PE' | ''
  strike?: string
  expiry?: string
  lotsize: string
}

export interface Position extends PositionContract {
  id: string
  side: 'BUY' | 'SELL'
  qty: number
  entryPrice: number
  entryTime: string
  exitPrice?: number
  exitTime?: string
  status: 'OPEN' | 'CLOSED'
  basketId?: string | null
  basketLabel?: string | null
}

export interface CandlePoint {
  0: string // timestamp
  1: number // open
  2: number // high
  3: number // low
  4: number // close
  5: number // volume
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error || `Request failed: ${res.status}`)
  }
  return body as T
}

export const api = {
  login: (payload: LoginPayload) =>
    request<SessionTokens>('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request('/api/logout', { method: 'POST' }),

  session: () => request<{ loggedIn: boolean; clientCode: string | null }>('/api/session'),

  restoreSession: (tokens: SessionTokens) =>
    request<SessionTokens>('/api/session/restore', {
      method: 'POST',
      body: JSON.stringify(tokens),
    }),

  refreshSession: (tokens: Omit<SessionTokens, 'jwtToken'>) =>
    request<SessionTokens>('/api/session/refresh', {
      method: 'POST',
      body: JSON.stringify(tokens),
    }),

  profile: () => request<{ status: boolean; data: Record<string, unknown> }>('/api/profile'),

  rms: () => request<{ status: boolean; data: Record<string, unknown> }>('/api/rms'),

  candleData: (params: {
    exchange: string
    symboltoken: string
    interval: string
    fromdate: string
    todate: string
  }) =>
    request<{ status: boolean; data: CandlePoint[] }>('/api/candle-data', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  searchInstruments: (query: string, exchange?: string, instrumenttype?: string) => {
    const params = new URLSearchParams({ q: query })
    if (exchange) params.set('exchange', exchange)
    if (instrumenttype) params.set('instrumenttype', instrumenttype)
    return request<Instrument[]>(`/api/instruments/search?${params.toString()}`)
  },

  indices: () => request<Instrument[]>('/api/instruments/indices'),

  optionUnderlyings: (q: string) =>
    request<string[]>(`/api/instruments/option-underlyings?q=${encodeURIComponent(q)}`),

  optionsChain: (name: string, exchange = 'NFO') =>
    request<Instrument[]>(
      `/api/instruments/options-chain?name=${encodeURIComponent(name)}&exchange=${exchange}`
    ),

  spot: (symbol: string) =>
    request<Instrument | null>(`/api/instruments/spot?symbol=${encodeURIComponent(symbol)}`),

  quote: (exchangeTokens: Record<string, string[]>, mode: 'LTP' | 'QUOTE' | 'FULL' = 'FULL') =>
    request<{ fetched: QuoteRow[]; unfetched: unknown[] }>('/api/market/quote', {
      method: 'POST',
      body: JSON.stringify({ exchangeTokens, mode }),
    }),

  optionGreeks: (name: string, expirydate: string) =>
    request<GreekRow[]>('/api/market/option-greeks', {
      method: 'POST',
      body: JSON.stringify({ name, expirydate }),
    }),

  positions: () => request<{ open: Position[]; closed: Position[] }>('/api/positions'),

  openPosition: (
    contract: PositionContract,
    side: 'BUY' | 'SELL',
    qty: number,
    entryPrice: number,
    basketId?: string,
    basketLabel?: string,
  ) =>
    request<Position>('/api/positions', {
      method: 'POST',
      body: JSON.stringify({ contract, side, qty, entryPrice, basketId, basketLabel }),
    }),

  closePosition: (id: string, exitPrice: number) =>
    request<Position>(`/api/positions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ exitPrice }),
    }),
}
