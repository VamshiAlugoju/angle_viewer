export interface LoginPayload {
  apiKey: string
  clientCode: string
  password: string
  totp: string
}

export interface Instrument {
  token: string
  symbol: string
  name: string
  exch_seg: string
  instrumenttype: string
  lotsize: string
  tick_size: string
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
    request<{ clientCode: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () => request('/api/logout', { method: 'POST' }),

  session: () => request<{ loggedIn: boolean; clientCode: string | null }>('/api/session'),

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
}
