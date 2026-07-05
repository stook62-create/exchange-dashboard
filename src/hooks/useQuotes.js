import { useEffect, useState } from 'react'
import { fetchQuotes } from '../services/api.js'

const POLL_INTERVAL_MS = 30_000

export function useQuotes() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const data = await fetchQuotes()
        if (!cancelled) {
          setQuotes(data)
          setLastUpdated(new Date())
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { quotes, loading, error, lastUpdated }
}
