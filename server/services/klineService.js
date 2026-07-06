import { SYMBOLS } from '../config/symbols.js'
import { parseSymbol } from '../utils/parseSymbol.js'
import { isMarketOpen } from '../utils/marketHours.js'

const EASTMONEY_HOSTS = ['push2his.eastmoney.com', 'push2.eastmoney.com']
const TENCENT_FQKLINE_URL = 'http://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
const TENCENT_MKLINE_URL = 'http://ifzq.gtimg.cn/appstock/app/kline/mkline'
const TENCENT_MINUTE_URL = 'http://web.ifzq.gtimg.cn/appstock/app/minute/query'
const SINA_DAILY_BASE = 'http://stock.finance.sina.com.cn/usstock/api/jsonp_v2.php'

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
  intraday: 30_000,
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
    const previous = this.queue
    this.queue = (async () => {
      // Wait for the previous task but swallow its error so the queue stays alive.
      await previous.catch(() => {})
      const now = Date.now()
      const wait = Math.max(0, this.minGapMs - (now - this.lastTime))
      if (wait > 0) await sleep(wait)
      try {
        return await fn()
      } finally {
        this.lastTime = Date.now()
      }
    })()
    return this.queue
  }
}

const eastmoneyThrottler = new HostThrottler(200)
const tencentThrottler = new HostThrottler(200)
const sinaThrottler = new HostThrottler(200)

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

function parseEastmoneyIntradayKlines(klines = []) {
  return klines.map((row) => {
    const parts = String(row).split(',')
    if (parts.length < 6) return null
    const [datetime, open, close, high, low, volume] = parts
    const time = datetime.trim().split(' ')[1] || datetime.trim()
    return {
      time,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }
  }).filter(Boolean)
}

function parseTencentFqkline(rows = []) {
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length < 6) return null
    // Tencent fqkline returns: [date, open, close, high, low, volume]
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

function parseTencentMkline(rows = []) {
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length < 6) return null
    // Tencent mkline returns: [YYYYMMDDHHMM, open, close, high, low, volume, {}, amplitude]
    const [time, open, close, high, low, volume] = row
    const t = String(time).trim()
    const hh = t.slice(-4, -2)
    const mm = t.slice(-2)
    return {
      time: `${hh}:${mm}`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }
  }).filter(Boolean)
}

function parseTencentMinuteQuery(rows = []) {
  return rows.map((row) => {
    const parts = String(row).trim().split(/\s+/)
    if (parts.length < 3) return null
    const [time, price, volume] = parts
    const t = String(time).padStart(4, '0')
    return {
      time: `${t.slice(0, 2)}:${t.slice(2)}`,
      open: Number(price),
      high: Number(price),
      low: Number(price),
      close: Number(price),
      volume: Number(volume),
    }
  }).filter(Boolean)
}

async function fetchEastmoneyKline(secid, period, limit) {
  const klt = PERIOD_TO_KLT[period]
  if (!klt) throw new Error(`Unsupported period: ${period}`)

  const path =
    `/api/qt/stock/kline/get?` +
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
    let lastErr = null
    for (const host of EASTMONEY_HOSTS) {
      try {
        const res = await fetch(`http://${host}${path}`, { headers: EASTMONEY_HEADERS })
        if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`)
        const json = await res.json()
        if (!json.data || !Array.isArray(json.data.klines)) {
          throw new Error('Eastmoney returned no klines')
        }
        const candles = parseEastmoneyKlines(json.data.klines)
        if (candles.length === 0) throw new Error('Eastmoney klines empty')
        return candles
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr || new Error('Eastmoney fetch failed')
  })
}

async function fetchEastmoneyIntraday(secid, dateStr) {
  const klt = PERIOD_TO_KLT.intraday
  if (!klt) throw new Error('Unsupported intraday period')

  const date = String(dateStr).replace(/-/g, '')
  const path =
    `/api/qt/stock/kline/get?` +
    `secid=${encodeURIComponent(secid)}` +
    `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
    `&klt=${klt}` +
    `&fqt=0` +
    `&beg=${date}` +
    `&end=${date}` +
    `&lmt=1000` +
    `&ut=fa5fd1943c7b386f172d6893dbfba10b`

  return eastmoneyThrottler.run(async () => {
    let lastErr = null
    for (const host of EASTMONEY_HOSTS) {
      try {
        const res = await fetch(`http://${host}${path}`, { headers: EASTMONEY_HEADERS })
        if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`)
        const json = await res.json()
        if (!json.data || !Array.isArray(json.data.klines)) {
          throw new Error('Eastmoney returned no klines')
        }
        const candles = parseEastmoneyIntradayKlines(json.data.klines)
        if (candles.length === 0) throw new Error('Eastmoney intraday empty')
        return candles
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr || new Error('Eastmoney intraday fetch failed')
  })
}

async function fetchTencentFqkline(tencentCode, period, limit) {
  const tencentPeriod = PERIOD_TO_TENCENT[period]
  if (!tencentPeriod) throw new Error(`Tencent fqkline does not support period: ${period}`)

  const url = `${TENCENT_FQKLINE_URL}?param=${tencentCode},${tencentPeriod},,,${limit},qfq`

  return tencentThrottler.run(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Tencent fqkline HTTP ${res.status}`)
    const text = await res.text()
    const json = text.startsWith('{') ? JSON.parse(text) : null
    const periodData = json?.data?.[tencentCode]
    if (!periodData) {
      throw new Error('Tencent fqkline returned no klines')
    }
    // Individual stocks return qfqday/qfqweek/qfqmonth, indices return day/week/month.
    const rows = periodData[`qfq${tencentPeriod}`] || periodData[tencentPeriod]
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Tencent fqkline returned no klines')
    }
    const candles = parseTencentFqkline(rows)
    if (candles.length === 0) throw new Error('Tencent fqkline empty')
    return candles
  })
}

async function fetchTencentMkline(tencentCode, limit = 320) {
  const url = `${TENCENT_MKLINE_URL}?param=${tencentCode},m1,,${limit}`

  return tencentThrottler.run(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Tencent mkline HTTP ${res.status}`)
    const json = await res.json()
    if (json.code !== 0 || !json.data?.[tencentCode]?.m1) {
      throw new Error('Tencent mkline returned no data')
    }
    const candles = parseTencentMkline(json.data[tencentCode].m1)
    if (candles.length === 0) throw new Error('Tencent mkline empty')
    return candles
  })
}

async function fetchTencentMinuteQuery(tencentCode) {
  const url = `${TENCENT_MINUTE_URL}?code=${tencentCode}`

  return tencentThrottler.run(async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Tencent minute query HTTP ${res.status}`)
    const json = await res.json()
    const rows = json.data?.[tencentCode]?.data?.data
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Tencent minute query returned no data')
    }
    return parseTencentMinuteQuery(rows)
  })
}

async function fetchSinaDaily(sinaSymbol, limit) {
  const callbackName = sinaSymbol.replace(/^\./, '')
  const url = `${SINA_DAILY_BASE}/var_${callbackName}=/US_MinKService.getDailyK?symbol=${sinaSymbol}&_=2025_1_1&___qn=3`

  return sinaThrottler.run(async () => {
    const res = await fetch(url, {
      headers: {
        Referer: 'https://finance.sina.com.cn/',
        'User-Agent': EASTMONEY_HEADERS['User-Agent'],
      },
    })
    if (!res.ok) throw new Error(`Sina HTTP ${res.status}`)
    const text = await res.text()
    const cleaned = text.replace(/\/\*\s*<script>[\s\S]*?<\/script>\s*\*\//, '').trim()
    const m = cleaned.match(/var_\w+=\(([\s\S]*?)\);?$/)
    if (!m) throw new Error('Sina response format unexpected')
    const rows = JSON.parse(m[1])
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Sina returned no data')
    }
    const candles = rows.slice(-limit).map((r) => ({
      time: r.d,
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v),
    }))
    return candles
  })
}

function getWeekKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const year = d.getUTCFullYear()
  // Sunday as first day of week
  const start = new Date(Date.UTC(year, 0, 1))
  const dayOffset = start.getUTCDay()
  const msPerDay = 86400000
  const weekNum = Math.floor((d.getTime() - start.getTime() + dayOffset * msPerDay) / (7 * msPerDay))
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

function getMonthKey(dateStr) {
  return dateStr.slice(0, 7)
}

function resample(candles, groupKeyFn) {
  const groups = new Map()
  for (const c of candles) {
    const key = groupKeyFn(c.time)
    if (!groups.has(key)) {
      groups.set(key, [c])
    } else {
      groups.get(key).push(c)
    }
  }

  const result = []
  for (const [, group] of groups) {
    group.sort((a, b) => a.time.localeCompare(b.time))
    result.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
    })
  }
  return result.sort((a, b) => a.time.localeCompare(b.time))
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

async function fetchDailyWeeklyMonthly(item, period, limit) {
  const cacheKey = getCacheKey(item.code, period, limit)
  const cached = getCached(cacheKey)
  if (cached) return { ...cached, cached: true }

  const errors = []

  // 1. For US indices, Sina daily is the most reliable source we found.
  //    Resample daily bars to weekly/monthly when needed.
  if (item.region === 'US' && item.sina) {
    try {
      const daily = await fetchSinaDaily(item.sina, 2000)
      const candles = period === 'daily' ? daily.slice(-limit) : resample(daily, period === 'weekly' ? getWeekKey : getMonthKey).slice(-limit)
      const result = makeEmptyResult(item, period, 'sina', null)
      result.candles = candles
      setCached(cacheKey, result, period)
      return result
    } catch (err) {
      errors.push(`Sina: ${err.message}`)
    }
  }

  // 2. Try Eastmoney for all regions (works well when network allows).
  try {
    const candles = await fetchEastmoneyKline(item.code, period, limit)
    const result = makeEmptyResult(item, period, 'eastmoney', null)
    result.candles = candles
    setCached(cacheKey, result, period)
    return result
  } catch (err) {
    errors.push(`Eastmoney: ${err.message}`)
  }

  // 3. Fallback to Tencent fqkline for any symbol with a tencent code.
  if (item.tencent) {
    try {
      const candles = await fetchTencentFqkline(item.tencent, period, limit)
      const result = makeEmptyResult(item, period, 'tencent', null)
      result.candles = candles
      setCached(cacheKey, result, period)
      return result
    } catch (err) {
      errors.push(`Tencent: ${err.message}`)
    }
  }

  const result = makeEmptyResult(item, period, 'none', errors.join('; '))
  return result
}

function getYahooSymbol(item) {
  const known = {
    '100.NDX': '^IXIC',
    '100.SPX': '^GSPC',
  }
  if (known[item.code]) return known[item.code]
  if (item.region === 'US') return item.displaySymbol
  return null
}

function formatYahooTime(timestampSec, timezone) {
  const d = new Date(timestampSec * 1000)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = formatter.formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('hour')}:${get('minute')}`
}

async function fetchYahooIntraday(item) {
  const yahooSymbol = getYahooSymbol(item)
  if (!yahooSymbol) return []

  const timezone = item.region === 'US' ? 'America/New_York' : 'Asia/Hong_Kong'
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&includePrePost=false`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error('Yahoo returned no chart result')

  const timestamps = result.timestamp || []
  const quote = result.indicators?.quote?.[0]
  const closes = quote?.close || []
  const opens = quote?.open || []
  const highs = quote?.high || []
  const lows = quote?.low || []
  const volumes = quote?.volume || []

  const candles = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (close == null) continue
    const time = formatYahooTime(timestamps[i], timezone)
    candles.push({
      time,
      open: opens[i] ?? close,
      high: highs[i] ?? close,
      low: lows[i] ?? close,
      close,
      volume: volumes[i] ?? 0,
    })
  }
  return candles
}

async function fetchIntraday(item, limit = 320) {
  const cacheKey = getCacheKey(item.code, 'intraday', limit)
  const cached = getCached(cacheKey)
  if (cached) return { ...cached, cached: true }

  const errors = []
  const isAshare = item.tencent && /^s[h|z]\d{6}$/i.test(item.tencent)
  let candles = null
  let source = 'none'

  // 1. For A-share symbols, Tencent mkline provides real 1-minute OHLCV.
  if (isAshare) {
    try {
      candles = await fetchTencentMkline(item.tencent, limit)
      source = 'tencent-mkline'
    } catch (err) {
      errors.push(`Tencent mkline: ${err.message}`)
    }
  }

  // 2. For HK/US and A-share fallback, use Tencent minute/query (price ticks).
  if (!candles && item.tencent) {
    try {
      candles = await fetchTencentMinuteQuery(item.tencent)
      source = 'tencent-minute'
    } catch (err) {
      errors.push(`Tencent minute: ${err.message}`)
    }
  }

  // 3. Outside market hours, if current session data is sparse/empty,
  //    fetch the most recent trading day's 1-minute data from Eastmoney (CN)
  //    or Yahoo Finance (US).
  if (!candles || candles.length < 30) {
    if (!isMarketOpen(item.region)) {
      try {
        const daily = await fetchEastmoneyKline(item.code, 'daily', 5)
        const lastCandle = daily[daily.length - 1]
        if (lastCandle?.time) {
          const hist = await fetchEastmoneyIntraday(item.code, lastCandle.time)
          if (hist.length > 0) {
            candles = hist
            source = 'eastmoney-historical'
          }
        }
      } catch (err) {
        errors.push(`Eastmoney historical: ${err.message}`)
      }

      if (!candles || candles.length < 30) {
        try {
          const hist = await fetchYahooIntraday(item)
          if (hist.length > 0) {
            candles = hist
            source = 'yahoo-historical'
          }
        } catch (err) {
          errors.push(`Yahoo historical: ${err.message}`)
        }
      }
    }
  }

  if (candles && candles.length > 0) {
    const result = makeEmptyResult(item, 'intraday', source, null)
    result.candles = candles
    setCached(cacheKey, result, 'intraday')
    return result
  }

  const result = makeEmptyResult(item, 'intraday', 'none', errors.join('; '))
  return result
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

export async function fetchKline(symbol, period, limit = 120) {
  const item = resolveSymbol(symbol)

  if (period === 'intraday') {
    return fetchIntraday(item, limit)
  }

  if (!PERIOD_TO_TENCENT[period]) {
    const err = new Error(`period must be one of daily, weekly, monthly, intraday`)
    err.statusCode = 400
    throw err
  }

  return fetchDailyWeeklyMonthly(item, period, limit)
}

export async function fetchIntradayKline(symbol, limit = 320) {
  return fetchKline(symbol, 'intraday', limit)
}
