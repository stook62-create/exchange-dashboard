import express from 'express'
import { fetchAllQuotes, fetchQuoteBySymbol } from '../services/eastmoneyService.js'

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.get('/quotes', async (_req, res) => {
  try {
    const quotes = await fetchAllQuotes()
    res.json(quotes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/quotes/:symbol', async (req, res) => {
  try {
    const quote = await fetchQuoteBySymbol(req.params.symbol)
    res.json(quote)
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message })
  }
})

export default router
