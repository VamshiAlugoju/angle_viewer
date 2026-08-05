import type { SessionTokens } from './api/client'

const STORAGE_KEY = 'smartapi.session'

export interface StoredSession extends SessionTokens {
  expiresAt: number // ms epoch, decoded from the jwt's `exp` claim
}

// SmartAPI's jwt is a standard JWT; decode its payload to read `exp` without any library.
function decodeJwtExpiry(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function saveSession(tokens: SessionTokens) {
  const expiresAt = decodeJwtExpiry(tokens.jwtToken) ?? Date.now() + 8 * 60 * 60 * 1000
  const stored: StoredSession = { ...tokens, expiresAt }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

// 30s skew so we refresh slightly before the jwt actually expires.
export function isExpired(stored: StoredSession, skewMs = 30_000) {
  return Date.now() >= stored.expiresAt - skewMs
}
