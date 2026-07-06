const MAX_CODE_LENGTH = 24
const VALID_CODE_RE = /^[A-Za-z0-9.]+$/

const SHANGHAI_INDEX_CODES = new Set(['000001', '000688'])

function isShanghaiNumeric(code) {
  return (
    SHANGHAI_INDEX_CODES.has(code) ||
    /^6\d{5}$/.test(code) ||
    /^688\d{3}$/.test(code)
  )
}

function isShenzhenNumeric(code) {
  return /^(000|001|002|003|300|301)\d{3}$/.test(code)
}

function makeTencentCode(region, body) {
  const lower = body.toLowerCase()
  if (region === 'CN') {
    // body is numeric 6 digits; prefix already determined
    return isShanghaiNumeric(body) ? `sh${body}` : `sz${body}`
  }
  if (region === 'HK') return `hk${body}`
  if (region === 'US') return `us${lower}`
  return null
}

function parseDirectSecid(input) {
  const [prefix, body] = input.split('.')
  if (!body) return null

  let region
  let currency
  let tencentPrefix
  let sina = null

  switch (prefix) {
    case '1':
      region = 'CN'
      currency = 'CNY'
      tencentPrefix = isShanghaiNumeric(body) ? 'sh' : 'sz'
      break
    case '0':
      region = 'CN'
      currency = 'CNY'
      tencentPrefix = 'sz'
      break
    case '100':
      region = 'US'
      currency = 'USD'
      tencentPrefix = 'us'
      sina = `.${body.toLowerCase()}`
      break
    case '105':
    case '106':
      region = 'US'
      currency = 'USD'
      tencentPrefix = 'us'
      sina = body.toLowerCase()
      break
    case '116':
      region = 'HK'
      currency = 'HKD'
      tencentPrefix = 'hk'
      break
    case '124':
      region = 'HK'
      currency = 'HKD'
      tencentPrefix = 'hk'
      break
    default:
      return null
  }

  return {
    code: input,
    displaySymbol: body.toUpperCase(),
    name: body.toUpperCase(),
    region,
    currency,
    tencent: `${tencentPrefix}${body.toLowerCase()}`,
    ...(sina ? { sina } : {}),
  }
}

function parsePrefixed(input) {
  const prefix = input.slice(0, 2).toLowerCase()
  const body = input.slice(2).toUpperCase()

  if (prefix === 'sh' && /^\d{6}$/.test(body)) {
    return {
      code: `1.${body}`,
      displaySymbol: body,
      name: body,
      region: 'CN',
      currency: 'CNY',
      tencent: `sh${body}`,
    }
  }

  if (prefix === 'sz' && /^\d{6}$/.test(body)) {
    return {
      code: `0.${body}`,
      displaySymbol: body,
      name: body,
      region: 'CN',
      currency: 'CNY',
      tencent: `sz${body}`,
    }
  }

  if (prefix === 'hk' && /^\d{5}$/.test(body)) {
    return {
      code: `116.${body}`,
      displaySymbol: body,
      name: body,
      region: 'HK',
      currency: 'HKD',
      tencent: `hk${body}`,
    }
  }

  if (prefix === 'us') {
    const ticker = body.replace(/^\./, '')
    if (!/^[A-Z0-9]{1,6}$/.test(ticker)) return null
    return {
      code: `105.${ticker}`,
      displaySymbol: ticker,
      name: ticker,
      region: 'US',
      currency: 'USD',
      tencent: `us${ticker.toLowerCase()}`,
      sina: ticker.toLowerCase(),
    }
  }

  return null
}

function parseNumeric(input) {
  if (/^\d{6}$/.test(input)) {
    if (isShanghaiNumeric(input)) {
      return {
        code: `1.${input}`,
        displaySymbol: input,
        name: input,
        region: 'CN',
        currency: 'CNY',
        tencent: `sh${input}`,
      }
    }
    if (isShenzhenNumeric(input)) {
      return {
        code: `0.${input}`,
        displaySymbol: input,
        name: input,
        region: 'CN',
        currency: 'CNY',
        tencent: `sz${input}`,
      }
    }
    return null
  }

  if (/^\d{5}$/.test(input)) {
    return {
      code: `116.${input}`,
      displaySymbol: input,
      name: input,
      region: 'HK',
      currency: 'HKD',
      tencent: `hk${input}`,
    }
  }

  return null
}

function parseUsTicker(input) {
  if (/^[A-Z]{1,5}$/.test(input)) {
    return {
      code: `105.${input}`,
      displaySymbol: input,
      name: input,
      region: 'US',
      currency: 'USD',
      tencent: `us${input.toLowerCase()}`,
      sina: input.toLowerCase(),
    }
  }

  if (/^\.[A-Z]{1,5}$/.test(input)) {
    const ticker = input.slice(1).toUpperCase()
    return {
      code: `100.${ticker}`,
      displaySymbol: ticker,
      name: ticker,
      region: 'US',
      currency: 'USD',
      tencent: `us${ticker.toLowerCase()}`,
      sina: `.${ticker.toLowerCase()}`,
    }
  }

  if (/^[A-Z]{1,4}\.[A-Z]$/.test(input)) {
    return {
      code: `105.${input}`,
      displaySymbol: input,
      name: input,
      region: 'US',
      currency: 'USD',
      tencent: `us${input.toLowerCase()}`,
      sina: input.toLowerCase(),
    }
  }

  return null
}

export function parseSymbol(input) {
  if (typeof input !== 'string') return null
  const raw = input.trim().toUpperCase()
  if (!raw || raw.length > MAX_CODE_LENGTH || !VALID_CODE_RE.test(raw)) {
    return null
  }

  return (
    parseDirectSecid(raw) ||
    parsePrefixed(raw) ||
    parseNumeric(raw) ||
    parseUsTicker(raw)
  )
}
