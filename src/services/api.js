const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export async function fetchQuotes() {
  const res = await fetch(`${API_BASE}/quotes`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}
