export function computeMA(candles, period) {
  if (!Array.isArray(candles) || candles.length === 0 || period <= 0) {
    return []
  }

  return candles.map((_, index) => {
    if (index < period - 1) return null
    const slice = candles.slice(index - period + 1, index + 1)
    const sum = slice.reduce((acc, candle) => acc + (candle.close ?? 0), 0)
    return sum / period
  })
}
