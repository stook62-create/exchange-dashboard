import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuotes } from '../hooks/useQuotes.js'
import { useCardOrder } from '../hooks/useCardOrder.js'
import { fetchQuoteBySymbol } from '../services/api.js'
import QuoteCard from './QuoteCard.jsx'
import ChartModal from './ChartModal.jsx'

const CUSTOM_SYMBOLS_KEY = 'exchange-dashboard:customSymbols'
const POLL_INTERVAL_MS = 30_000
const MAX_CUSTOM_SYMBOLS = 3

const VALID_INPUT_RE = /^[A-Za-z0-9.]+$/

const DEFAULT_CARD_ORDER = [
  '1.000001',   // 上证指数
  '0.399006',   // 创业板指
  '1.000688',   // 科创50
  '124.HSTECH', // 恒生科技指数
  '100.NDX',    // 纳斯达克
  '100.SPX',    // 标普500
]

export default function QuoteGrid() {
  const { quotes, loading, error, lastUpdated } = useQuotes()
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const [customSymbols, setCustomSymbols] = useState([])
  const [customQuotes, setCustomQuotes] = useState([])
  const [customLoading, setCustomLoading] = useState(false)
  const [customError, setCustomError] = useState(null)
  const [input, setInput] = useState('')

  // Load saved custom symbols once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SYMBOLS_KEY)
      const saved = raw ? JSON.parse(raw) : []
      if (Array.isArray(saved)) {
        setCustomSymbols(saved.filter((s) => typeof s === 'string' && s.length > 0))
      }
    } catch {
      setCustomSymbols([])
    }
  }, [])

  const fetchCustomQuotes = useCallback(async (symbols) => {
    if (symbols.length === 0) {
      setCustomQuotes([])
      return
    }
    setCustomLoading(true)
    try {
      const results = await Promise.all(
        symbols.map((symbol) => fetchQuoteBySymbol(symbol)),
      )
      setCustomQuotes(results)
      setCustomError(null)
    } catch (err) {
      setCustomError(err.message)
    } finally {
      setCustomLoading(false)
    }
  }, [])

  // Poll custom quotes on the same cadence as built-ins.
  useEffect(() => {
    fetchCustomQuotes(customSymbols)
    const interval = setInterval(() => fetchCustomQuotes(customSymbols), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [customSymbols, fetchCustomQuotes])

  const allQuotes = useMemo(() => [...quotes, ...customQuotes], [quotes, customQuotes])
  const allSymbols = useMemo(() => allQuotes.map((q) => q.symbol), [allQuotes])
  const { orderedSymbols, moveSymbol } = useCardOrder(allSymbols, DEFAULT_CARD_ORDER)

  const orderedQuotes = useMemo(() => {
    const quoteMap = new Map(allQuotes.map((q) => [q.symbol, q]))
    return orderedSymbols
      .map((symbol) => quoteMap.get(symbol))
      .filter(Boolean)
  }, [allQuotes, orderedSymbols])

  const selectedQuote = useMemo(
    () => orderedQuotes.find((q) => q.symbol === selectedSymbol),
    [orderedQuotes, selectedSymbol],
  )

  const handleDragStart = (_symbol, e) => {
    e.dataTransfer.setData('text/plain', _symbol)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (targetSymbol, e) => {
    e.preventDefault()
    const draggedSymbol = e.dataTransfer.getData('text/plain')
    if (draggedSymbol && draggedSymbol !== targetSymbol) {
      moveSymbol(draggedSymbol, targetSymbol)
    }
  }

  const handleAddCustom = async (e) => {
    e.preventDefault()
    const raw = input.trim().toUpperCase()
    if (!raw) return

    if (raw.length > 24 || !VALID_INPUT_RE.test(raw)) {
      setCustomError('代码只能包含字母、数字和点，且不超过 24 个字符')
      return
    }

    if (customSymbols.length >= MAX_CUSTOM_SYMBOLS) {
      setCustomError('最多只能添加 3 个自定义看盘标的')
      return
    }

    if (customSymbols.includes(raw)) {
      setCustomError('该代码已经添加')
      return
    }

    try {
      const quote = await fetchQuoteBySymbol(raw)
      if (quote.error) {
        throw new Error(quote.error)
      }
      const resolvedSymbol = quote.symbol || raw
      if (customSymbols.includes(resolvedSymbol)) {
        setCustomError('该标的已经存在')
        return
      }
      const next = [...customSymbols, resolvedSymbol]
      setCustomSymbols(next)
      try {
        localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      setInput('')
      setCustomError(null)
    } catch (err) {
      setCustomError(`添加失败：${err.message}`)
    }
  }

  const handleRemoveCustom = (symbol) => {
    const next = customSymbols.filter((s) => s !== symbol)
    setCustomSymbols(next)
    setCustomQuotes((prev) => prev.filter((q) => q.symbol !== symbol))
    try {
      localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

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
      {(error || customError) && (
        <div className="mb-4 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
          {error && <div>行情拉取失败：{error}</div>}
          {customError && <div className="mt-1">{customError}</div>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedQuotes.map((quote) => (
          <QuoteCard
            key={quote.symbol}
            quote={quote}
            onClick={() => setSelectedSymbol(quote.symbol)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onRemove={
              customSymbols.includes(quote.symbol)
                ? () => handleRemoveCustom(quote.symbol)
                : undefined
            }
          />
        ))}
      </div>

      {lastUpdated && (
        <p className="mt-4 text-xs text-slate-400">
          更新时间：{lastUpdated.toLocaleString('zh-CN')}
        </p>
      )}

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">自定义看盘（最多 3 个）</h3>
        <form onSubmit={handleAddCustom} className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入代码，如 600519 / 00700 / AAPL"
            disabled={customSymbols.length >= MAX_CUSTOM_SYMBOLS}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={customSymbols.length >= MAX_CUSTOM_SYMBOLS || !input.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300"
          >
            添加
          </button>
        </form>

        {customSymbols.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {customSymbols.map((symbol) => {
              const quote = customQuotes.find((q) => q.symbol === symbol)
              return (
                <div
                  key={symbol}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                >
                  <span>{quote?.displaySymbol || quote?.name || symbol}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustom(symbol)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="移除"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {customLoading && customSymbols.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">自定义行情加载中…</p>
        )}
      </div>

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
