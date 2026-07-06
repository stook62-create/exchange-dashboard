import { useEffect, useMemo, useState } from 'react'

const ORDER_KEY = 'exchange-dashboard:cardOrder:v2'

export function useCardOrder(symbols, defaultOrder = []) {
  const [order, setOrder] = useState([])

  // Load saved order once on mount; fall back to the provided default order.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY)
      const saved = raw ? JSON.parse(raw) : null
      if (Array.isArray(saved) && saved.length > 0) {
        setOrder(saved.filter(Boolean))
      } else {
        setOrder(defaultOrder.filter(Boolean))
      }
    } catch {
      setOrder(defaultOrder.filter(Boolean))
    }
  }, [])

  // Reconcile order when the available symbol list changes:
  // keep existing relative order, append any new symbols at the end.
  useEffect(() => {
    if (symbols.length === 0) return
    const symbolSet = new Set(symbols)
    const preserved = order.filter((s) => symbolSet.has(s))
    const appended = symbols.filter((s) => !preserved.includes(s))
    const next = [...preserved, ...appended]
    if (JSON.stringify(next) !== JSON.stringify(order)) {
      setOrder(next)
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
    }
  }, [symbols])

  const orderedSymbols = useMemo(() => {
    const symbolSet = new Set(symbols)
    const preserved = order.filter((s) => symbolSet.has(s))
    const appended = symbols.filter((s) => !preserved.includes(s))
    return [...preserved, ...appended]
  }, [symbols, order])

  const moveSymbol = (fromSymbol, toSymbol) => {
    if (fromSymbol === toSymbol) return
    const fromIndex = order.indexOf(fromSymbol)
    const toIndex = order.indexOf(toSymbol)
    if (fromIndex === -1 || toIndex === -1) return

    const next = [...order]
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, fromSymbol)
    setOrder(next)
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  return { orderedSymbols, moveSymbol }
}
