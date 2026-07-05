import { useState, useMemo } from 'react'
import { useQuotes } from '../hooks/useQuotes.js'
import QuoteCard from './QuoteCard.jsx'
import ChartModal from './ChartModal.jsx'

export default function QuoteGrid() {
  const { quotes, loading, error, lastUpdated } = useQuotes()
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.symbol === selectedSymbol),
    [quotes, selectedSymbol],
  )

  if (loading && quotes.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          行情拉取失败：{error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((quote) => (
          <QuoteCard
            key={quote.symbol}
            quote={quote}
            onClick={() => setSelectedSymbol(quote.symbol)}
          />
        ))}
      </div>

      {lastUpdated && (
        <p className="mt-4 text-xs text-slate-400">
          更新时间：{lastUpdated.toLocaleString('zh-CN')}
        </p>
      )}

      {selectedQuote && (
        <ChartModal
          symbol={selectedQuote.symbol}
          displaySymbol={selectedQuote.displaySymbol}
          name={selectedQuote.name}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  )
}
