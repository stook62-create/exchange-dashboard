const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export async function fetchQuotes() {
  const res = await fetch(`${API_BASE}/quotes`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchKline(symbol, period = 'daily', limit = 120) {
  const res = await fetch(
    `${API_BASE}/kline/${encodeURIComponent(symbol)}?period=${period}&limit=${limit}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchIntradayKline(symbol, limit = 240) {
  const res = await fetch(
    `${API_BASE}/kline/${encodeURIComponent(symbol)}/intraday?limit=${limit}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
