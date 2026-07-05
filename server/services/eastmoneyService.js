import { SYMBOLS } from '../config/symbols.js'

const API_BASE = 'https://push2.eastmoney.com/api/qt/stock/get'

const FIELDS = 'f43,f44,f45,f57,f58,f60,f170'

function parseScaled(value, digits = 2) {
  if (value === undefined || value === null || value === '-') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Number((num / Math.pow(10, digits)).toFixed(digits))
}

async function fetchSingle(item) {
  const url = `${API_BASE}?secid=${encodeURIComponent(item.code)}&fields=${FIELDS}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    const data = json.data
    if (!data) {
      throw new Error('No data returned')
    }
    const price = parseScaled(data.f43, 2)
    const prevClose = parseScaled(data.f60, 2)
    const change = price !== null && prevClose !== null ? Number((price - prevClose).toFixed(2)) : null
    const changePercent = parseScaled(data.f170, 2)
    return {
      symbol: item.code,
      displaySymbol: data.f57 || item.displaySymbol,
      name: data.f58 || item.name,
      region: item.region,
      currency: item.currency,
      price,
      change,
      changePercent,
      marketState: 'REGULAR',
      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    return {
      symbol: item.code,
      displaySymbol: item.displaySymbol,
      name: item.name,
      region: item.region,
      currency: item.currency,
      price: null,
      change: null,
      changePercent: null,
      marketState: 'ERROR',
      lastUpdated: new Date().toISOString(),
      error: err.message,
    }
  }
}

export async function fetchAllQuotes() {
  const results = await Promise.all(SYMBOLS.map(fetchSingle))
  return results
}

export async function fetchQuoteBySymbol(symbol) {
  const target = SYMBOLS.find((s) => s.code === symbol)
  if (!target) {
    throw new Error(`Symbol ${symbol} not found`)
  }
  return fetchSingle(target)
}
