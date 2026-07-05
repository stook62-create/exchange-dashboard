import { useEffect, useState } from 'react'

export function useKline(fetcher, symbol, enabled = true) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !symbol) return

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetcher(symbol)
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetcher, symbol, enabled])

  return { data, loading, error }
}
