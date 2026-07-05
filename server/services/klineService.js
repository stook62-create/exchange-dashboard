import { SYMBOLS } from '../config/symbols.js'

const EASTMONEY_KLINE_URL = 'https://push2.eastmoney.com/api/qt/stock/kline/get'
const TENCENT_KLINE_URL = 'http://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

const PERIOD_TO_KLT = {
  intraday: '1',
  daily: '101',
  weekly: '102',
  monthly: '103',
}

const PERIOD_TO_TENCENT = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
}

const CACHE_TTL_MS = {
  intraday: 60_000,
  daily: 300_000,
  weekly: 300_000,
  monthly: 300_000,
}

const EASTMONEY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Referer: 'https://quote.eastmoney.com/',
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class HostThrottler {
  constructor(minGapMs = 200) {
    this.minGapMs = minGapMs
    this.lastTime = 0
    this.queue = Promise.resolve()
  }

  async run(fn) {
    this.queue = this.queue.then(async () => {
      const now = Date.now()
      const wait = Math.max(0, this.minGapMs - (now - this.lastTime))
      if (wait > 0) await sleep(wait)
      try {
        return await fn()
      } finally {
        this.lastTime = Date.now()
      }
    })
    return this.queue
  }
}

const eastmoneyThrottler = new HostThrottler(200)
const tencentThrottler = new HostThrottler(200)

const cache = new Map()

function getCacheKey(symbol, period, limit) {
  return `${symbol}:${period}:${limit}`
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCached(key, data, period) {
  const ttl = CACHE_TTL_MS[period] || 60_000
  cache.set(key, { data, expiresAt: Date.now() + ttl })
}

function parseEastmoneyKlines(klines = []) {
  return klines.map((row) => {
    const parts = String(row).split(',')
    if (parts.length < 6) return null
    const [time, open, close, high, low, volume] = parts
    return {
      time: time.trim(),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }
  }).filter(Boolean)
}

function parseTencentKlines(rows = []) {
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length < 6) return null
    // Tencent returns: [date, open, close, high, low, volume]
    const [time, open, close, high, low, volume] = row
    return {
      time: String(time).trim(),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }
  }).filter(Boolean)
}

async function fetchEastmoneyKline(secid, period, limit) {
  const klt = PERIOD_TO_KLT[period]
  if (!klt) throw new Error(`Unsupported period: ${period}`)

  const url =
    `${EASTMONEY_KLINE_URL}?` +
    `secid=${encodeURIComponent(secid)}` +
    `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
    `&klt=${klt}` +
    `&fqt=0` +
    `&beg=0` +
    `&end=20500101` +
    `&lmt=${limit}` +
    `&ut=fa5fd1943c7b386f172d6893dbfba10b`

  return eastmoneyThrottler.run(async () => {
    const res = await fetch(url, { headers: EASTMONEY_HEADERS })
    if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`)
    const json = await res.json()
    if (!json.data || !Array.isArray(json.data.klines)) {
      throw new Error('Eastmoney returned no klines')
    }
    const candles = parseEastmoneyKlines(json.data.klines)
    if (candles.length === 0) throw new Error('Eastmoney klines empty')
    return candles
  })
}

async function fetchTencentKline(tencentCode, period, limit) {
  const tencentPeriod = PERIOD_TO_TENCENT[period]
  if (!tencentPeriod) throw new Error(`Tencent does not support period: ${period}`)

  const url = `${TENCENT_KLINE_URL}?param=${tencentCode},${tencentPeriod},,,${limit},qfq`

  return tencentThrottler.run(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Tencent HTTP ${res.status}`)
    const text = await res.text()
    const json = text.startsWith('{') ? JSON.parse(text) : null
    if (!json?.data?.[tencentCode]?.[tencentPeriod]) {
      throw new Error('Tencent returned no klines')
    }
    const candles = parseTencentKlines(json.data[tencentCode][tencentPeriod])
    if (candles.length === 0) throw new Error('Tencent klines empty')
    return candles
  })
}

function makeEmptyResult(item, period, source, error) {
  return {
    symbol: item.code,
    displaySymbol: item.displaySymbol,
    name: item.name,
    region: item.region,
    currency: item.currency,
    period,
    source,
    candles: [],
    error: error || null,
    lastUpdated: new Date().toISOString(),
  }
}

export async function fetchKline(symbol, period, limit = 120) {
  const item = SYMBOLS.find((s) => s.code === symbol)
  if (!item) {
    const err = new Error(`Symbol ${symbol} not found`)
    err.statusCode = 404
    throw err
  }

  const cacheKey = getCacheKey(symbol, period, limit)
  const cached = getCached(cacheKey)
  if (cached) {
    return { ...cached, cached: true }
  }

  // 1. Try Eastmoney first
  try {
    const candles = await fetchEastmoneyKline(item.code, period, limit)
    const result = makeEmptyResult(item, period, 'eastmoney', null)
    result.candles = candles
    setCached(cacheKey, result, period)
    return result
  } catch (emErr) {
    // 2. Fallback to Tencent for daily/weekly/monthly only
    if (PERIOD_TO_TENCENT[period] && item.tencent) {
      try {
        const candles = await fetchTencentKline(item.tencent, period, limit)
        const result = makeEmptyResult(item, period, 'tencent', null)
        result.candles = candles
        setCached(cacheKey, result, period)
        return result
      } catch (txErr) {
        const result = makeEmptyResult(
          item,
          period,
          'none',
          `Eastmoney: ${emErr.message}; Tencent: ${txErr.message}`,
        )
        return result
      }
    }

    const result = makeEmptyResult(item, period, 'none', `Eastmoney: ${emErr.message}`)
    return result
  }
}

export async function fetchIntradayKline(symbol, limit = 240) {
  return fetchKline(symbol, 'intraday', limit)
}
