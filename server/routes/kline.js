import express from 'express'
import { fetchKline, fetchIntradayKline } from '../services/klineService.js'

const router = express.Router()

const VALID_PERIODS = ['daily', 'weekly', 'monthly']

router.get('/kline/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    const period = req.query.period || 'daily'
    const limit = Number(req.query.limit) || 120

    if (!VALID_PERIODS.includes(period)) {
      return res.status(400).json({ error: `period must be one of ${VALID_PERIODS.join(', ')}` })
    }
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1000) {
      return res.status(400).json({ error: 'limit must be between 1 and 1000' })
    }

    const data = await fetchKline(symbol, period, limit)
    res.json(data)
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ error: err.message })
  }
})

router.get('/kline/:symbol/intraday', async (req, res) => {
  try {
    const { symbol } = req.params
    const limit = Number(req.query.limit) || 240
    const data = await fetchIntradayKline(symbol, limit)
    res.json(data)
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ error: err.message })
  }
})

export default router
