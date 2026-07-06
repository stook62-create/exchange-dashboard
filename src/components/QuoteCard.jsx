import { useMemo } from 'react'
import { fetchIntradayKline } from '../services/api.js'
import { useKline } from '../hooks/useKline.js'
import IntradayChart from './IntradayChart.jsx'

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

export default function QuoteCard({ quote, onClick, onDragStart, onDragOver, onDrop }) {
  const isUp = quote.changePercent > 0
  const isDown = quote.changePercent < 0
  const colorClass = isUp ? 'text-up' : isDown ? 'text-down' : 'text-slate-500'

  const fetcher = useMemo(() => (sym) => fetchIntradayKline(sym, 120), [])
  const { data: intradayData, loading: intradayLoading } = useKline(
    fetcher,
    quote.symbol,
    true,
  )

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.()
      }}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(quote.symbol, e)}
      className="cursor-pointer rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <button
            type="button"
            draggable
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => onDragStart?.(quote.symbol, e)}
            className="mt-1 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
            aria-label="拖动排序"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="18" r="2" />
              <circle cx="15" cy="18" r="2" />
            </svg>
          </button>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{quote.name}</h3>
            <p className="text-sm text-slate-500">
              {quote.displaySymbol} · {quote.region} · {quote.currency}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {quote.marketState}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {formatNumber(quote.price)}
        </p>
        <div className={`mt-1 flex items-center gap-3 text-sm font-medium ${colorClass}`}>
          <span>{formatChange(quote.change)}</span>
          <span className="rounded-md bg-current/10 px-2 py-0.5">{formatPercent(quote.changePercent)}</span>
        </div>
      </div>

      {intradayLoading ? (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <IntradayChart data={intradayData} changePercent={quote.changePercent} />
      )}

      {quote.error && (
        <p className="mt-3 text-xs text-rose-500">
          数据获取失败：{quote.error}
        </p>
      )}
    </div>
  )
}
