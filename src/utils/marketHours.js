const MARKET_TIMEZONES = {
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  US: 'America/New_York',
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function rangeSlots(startHour, startMin, endHour, endMin) {
  const slots = []
  let h = startHour
  let m = startMin
  while (h < endHour || (h === endHour && m <= endMin)) {
    slots.push(`${pad2(h)}:${pad2(m)}`)
    m += 1
    if (m >= 60) {
      m = 0
      h += 1
    }
  }
  return slots
}

export function getMarketTimezone(region) {
  return MARKET_TIMEZONES[region] || MARKET_TIMEZONES.US
}

export function getMarketSlots(region) {
  switch (region) {
    case 'CN':
      return [
        ...rangeSlots(9, 30, 11, 30),
        ...rangeSlots(13, 0, 15, 0),
      ]
    case 'HK':
      return [
        ...rangeSlots(9, 30, 12, 0),
        ...rangeSlots(13, 0, 16, 0),
      ]
    case 'US':
    default:
      return rangeSlots(9, 30, 16, 0)
  }
}

export function getCurrentMarketTime(region) {
  const tz = getMarketTimezone(region)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('hour')}:${get('minute')}`
}

export function alignIntradayData(candles, region) {
  const categories = getMarketSlots(region)
  const currentTime = getCurrentMarketTime(region)
  const valueMap = new Map()
  for (const c of candles) {
    if (c.time && !valueMap.has(c.time)) {
      valueMap.set(c.time, c.close)
    }
  }

  const values = categories.map((slot) => {
    if (slot > currentTime) return null
    return valueMap.has(slot) ? valueMap.get(slot) : null
  })

  return { categories, values }
}
