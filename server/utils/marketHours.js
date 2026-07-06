const MARKET_TIMEZONES = {
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  US: 'America/New_York',
}

function getMarketParts(date, region) {
  const timeZone = MARKET_TIMEZONES[region] || MARKET_TIMEZONES.US
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = formatter.formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dayOfWeek: get('weekday'),
  }
}

function toMinutes(hour, minute) {
  return hour * 60 + minute
}

function isWeekend(dayOfWeek) {
  return dayOfWeek === 'Sat' || dayOfWeek === 'Sun'
}

export function getMarketTimezone(region) {
  return MARKET_TIMEZONES[region] || MARKET_TIMEZONES.US
}

export function isMarketOpen(region, date = new Date()) {
  const { hour, minute, dayOfWeek } = getMarketParts(date, region)
  if (isWeekend(dayOfWeek)) return false

  const minutes = toMinutes(hour, minute)

  switch (region) {
    case 'CN':
      return (
        (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) ||
        (minutes >= 13 * 60 && minutes <= 15 * 60)
      )
    case 'HK':
      return (
        (minutes >= 9 * 60 + 30 && minutes <= 12 * 60) ||
        (minutes >= 13 * 60 && minutes <= 16 * 60)
      )
    case 'US':
    default:
      return minutes >= 9 * 60 + 30 && minutes <= 16 * 60
  }
}
