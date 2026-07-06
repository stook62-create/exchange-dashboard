const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchQuotes() {
  return fetchJSON(`${API_BASE}/quotes`)
}

export async function fetchQuoteBySymbol(symbol) {
  return fetchJSON(`${API_BASE}/quotes/${encodeURIComponent(symbol)}`)
}

export async function fetchKline(symbol, period = 'daily', limit = 120) {
  return fetchJSON(
    `${API_BASE}/kline/${encodeURIComponent(symbol)}?period=${period}&limit=${limit}`,
  )
}

export async function fetchIntradayKline(symbol, limit = 240) {
  return fetchJSON(
    `${API_BASE}/kline/${encodeURIComponent(symbol)}/intraday?limit=${limit}`,
  )
}
