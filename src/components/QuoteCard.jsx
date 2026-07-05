function formatNumber(value, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatChange(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 2)}`
}

function formatPercent(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 2)}%`
}

export default function QuoteCard({ quote }) {
  const isUp = quote.changePercent > 0
  const isDown = quote.changePercent < 0
  const colorClass = isUp ? 'text-up' : isDown ? 'text-down' : 'text-slate-500'

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{quote.name}</h3>
          <p className="text-sm text-slate-500">
            {quote.displaySymbol} · {quote.region} · {quote.currency}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {quote.marketState}
        </span>
      </div>

      <div className="mt-6">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {formatNumber(quote.price)}
        </p>
        <div className={`mt-2 flex items-center gap-3 text-sm font-medium ${colorClass}`}>
          <span>{formatChange(quote.change)}</span>
          <span className="rounded-md bg-current/10 px-2 py-0.5">{formatPercent(quote.changePercent)}</span>
        </div>
      </div>

      {quote.error && (
        <p className="mt-4 text-xs text-rose-500">
          数据获取失败：{quote.error}
        </p>
      )}
    </div>
  )
}
