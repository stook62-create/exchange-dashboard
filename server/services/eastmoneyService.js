import { TextDecoder } from 'util'
import { SYMBOLS } from '../config/symbols.js'
import { parseSymbol } from '../utils/parseSymbol.js'

const API_BASE = 'https://push2.eastmoney.com/api/qt/stock/get'
const TENCENT_QUOTE_URL = 'https://qt.gtimg.cn/q='

const FIELDS = 'f43,f44,f45,f57,f58,f60,f170'

const EASTMONEY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Referer: 'https://quote.eastmoney.com/',
}

function parseScaled(value, digits = 2) {
  if (value === undefined || value === null || value === '-') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Number((num / Math.pow(10, digits)).toFixed(digits))
}

function resolveSymbol(symbol) {
  const configured = SYMBOLS.find((s) => s.code === symbol)
  if (configured) return configured
  const parsed = parseSymbol(symbol)
  if (!parsed) {
    const err = new Error(`Symbol ${symbol} not found`)
    err.statusCode = 404
    throw err
  }
  return parsed
}

async function fetchSingle(item) {
  const url = `${API_BASE}?secid=${encodeURIComponent(item.code)}&fields=${FIELDS}`
  try {
    const res = await fetch(url, { headers: EASTMONEY_HEADERS })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    const data = json.data
    if (!data) {
      throw new Error('No data returned')
    }
    const isUsStock = item.region === 'US' && (item.code.startsWith('105.') || item.code.startsWith('106.'))
    const priceDigits = isUsStock ? 3 : 2
    const price = parseScaled(data.f43, priceDigits)
    const prevClose = parseScaled(data.f60, priceDigits)
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

function parseTencentQuote(raw, item) {
  try {
    const m = raw.match(/="(.+?)";?$/)
    if (!m) return null
    const parts = m[1].split('~')
    if (parts.length < 6) return null

    const price = Number(parts[3])
    const prevClose = Number(parts[4])
    const open = Number(parts[5])
    const volume = Number(parts[6])

    let tsIndex = -1
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(parts[i]) || /^\d{14}$/.test(parts[i])) {
        tsIndex = i
        break
      }
    }

    const change = tsIndex >= 0 && parts[tsIndex + 1] ? Number(parts[tsIndex + 1]) : null
    const changePercent = tsIndex >= 0 && parts[tsIndex + 2] ? Number(parts[tsIndex + 2]) : null
    const high = tsIndex >= 0 && parts[tsIndex + 3] ? Number(parts[tsIndex + 3]) : null
    const low = tsIndex >= 0 && parts[tsIndex + 4] ? Number(parts[tsIndex + 4]) : null

    return {
      symbol: item.code,
      displaySymbol: item.displaySymbol,
      name: item.name,
      region: item.region,
      currency: item.currency,
      price: Number.isFinite(price) ? price : null,
      change: Number.isFinite(change) ? change : (Number.isFinite(price) && Number.isFinite(prevClose) ? Number((price - prevClose).toFixed(2)) : null),
      changePercent: Number.isFinite(changePercent) ? changePercent : null,
      marketState: 'REGULAR',
      lastUpdated: new Date().toISOString(),
      _meta: { open, high, low, volume },
    }
  } catch (err) {
    return null
  }
}

async function fetchTencentBatch(items) {
  const codes = items.map((item) => item.tencent).filter(Boolean)
  if (codes.length === 0) return new Map()

  const url = `${TENCENT_QUOTE_URL}${codes.join(',')}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': EASTMONEY_HEADERS['User-Agent'],
        Referer: 'https://quote.tencent.com/',
      },
    })
    if (!res.ok) throw new Error(`Tencent HTTP ${res.status}`)

    const buffer = await res.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buffer)
    const lines = text.split(';').filter((line) => line.trim())

    const codeToItem = new Map(items.map((item) => [item.tencent, item]))
    const result = new Map()

    for (const line of lines) {
      const codeMatch = line.match(/v_(\w+)=/)
      if (!codeMatch) continue
      const code = codeMatch[1]
      const item = codeToItem.get(code)
      if (!item) continue
      const quote = parseTencentQuote(line, item)
      if (quote) result.set(item.code, quote)
    }

    return result
  } catch (err) {
    console.error('Tencent batch quote failed:', err.message)
    return new Map()
  }
}

export async function fetchAllQuotes() {
  const results = await Promise.all(SYMBOLS.map(fetchSingle))
  const failedItems = results
    .filter((r) => r.marketState === 'ERROR')
    .map((r) => SYMBOLS.find((s) => s.code === r.symbol))
    .filter(Boolean)

  if (failedItems.length > 0) {
    const tencentMap = await fetchTencentBatch(failedItems)
    return results.map((r) => {
      if (r.marketState === 'ERROR' && tencentMap.has(r.symbol)) {
        return tencentMap.get(r.symbol)
      }
      return r
    })
  }

  return results
}

export async function fetchQuoteBySymbol(symbol) {
  const target = resolveSymbol(symbol)
  const result = await fetchSingle(target)
  if (result.marketState !== 'ERROR') return result

  const tencentMap = await fetchTencentBatch([target])
  if (tencentMap.has(symbol) || tencentMap.has(target.code)) {
    return tencentMap.get(symbol) || tencentMap.get(target.code)
  }
  return result
}
