import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { fetchKline } from '../services/api.js'
import { useKline } from '../hooks/useKline.js'
import { computeMA } from '../utils/ma.js'

const PERIODS = [
  { key: 'daily', label: '日线' },
  { key: 'weekly', label: '周线' },
  { key: 'monthly', label: '月线' },
]

const MA_PERIODS = [
  { key: 'MA5', period: 5, color: '#3b82f6' },
  { key: 'MA10', period: 10, color: '#f59e0b' },
  { key: 'MA20', period: 20, color: '#8b5cf6' },
  { key: 'MA60', period: 60, color: '#64748b' },
]

export default function ChartModal({ symbol, displaySymbol, name, onClose }) {
  const [activePeriod, setActivePeriod] = useState('daily')

  const fetcher = useMemo(
    () => (sym) => fetchKline(sym, activePeriod, 120),
    [activePeriod],
  )

  const { data, loading, error } = useKline(fetcher, symbol, true)

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const option = useMemo(() => {
    if (!data || data.candles.length === 0) return null

    const times = data.candles.map((c) => c.time)
    const candleData = data.candles.map((c) => [c.open, c.close, c.low, c.high])
    const volumeData = data.candles.map((c) => ({
      value: c.volume,
      itemStyle: {
        color: c.close >= c.open ? '#ef4444' : '#22c55e',
      },
    }))

    const maSeries = MA_PERIODS.map(({ key, period, color }) => ({
      name: key,
      type: 'line',
      data: computeMA(data.candles, period),
      smooth: false,
      symbol: 'none',
      lineStyle: { width: 1.5, color },
      itemStyle: { color },
    }))

    return {
      animation: true,
      legend: {
        data: ['K线', ...MA_PERIODS.map((m) => m.key), '成交量'],
        top: '2%',
        textStyle: { color: '#475569' },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          const candle = params.find((p) => p.seriesName === 'K线')
          if (!candle) return ''
          const [open, close, low, high] = candle.data
          const lines = [
            candle.name,
            `开: ${open.toFixed(2)}`,
            `收: ${close.toFixed(2)}`,
            `高: ${high.toFixed(2)}`,
            `低: ${low.toFixed(2)}`,
          ]

          const volume = params.find((p) => p.seriesName === '成交量')
          if (volume && volume.data != null) {
            const v = typeof volume.data === 'object' ? volume.data.value : volume.data
            let formatted = String(v)
            if (v >= 1e9) formatted = `${(v / 1e9).toFixed(2)}B`
            else if (v >= 1e6) formatted = `${(v / 1e6).toFixed(2)}M`
            else if (v >= 1e3) formatted = `${(v / 1e3).toFixed(2)}K`
            lines.push(`成交量: ${formatted}`)
          }

          MA_PERIODS.forEach(({ key }) => {
            const ma = params.find((p) => p.seriesName === key)
            if (ma && ma.data != null) {
              lines.push(`${key}: ${Number(ma.data).toFixed(2)}`)
            }
          })

          return lines.join('<br/>')
        },
      },
      grid: [
        { left: '10%', right: '4%', top: '14%', height: '58%' },
        { left: '10%', right: '4%', top: '76%', height: '12%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: times,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
        {
          type: 'category',
          gridIndex: 1,
          data: times,
          axisLabel: { rotate: 30 },
        },
      ],
      yAxis: [
        {
          scale: true,
          splitArea: { show: true },
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: {
            show: true,
            fontSize: 10,
            formatter: (value) => {
              if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
              if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
              if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
              return value
            },
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1] },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          bottom: '2%',
          height: '6%',
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: candleData,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
        },
        ...maSeries,
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumeData,
        },
      ],
    }
  }, [data])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500">{displaySymbol} · K 线图</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-100 px-6 py-3">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePeriod(p.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                activePeriod === p.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="relative min-h-[50vh] flex-1 p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-slate-400">
              加载中...
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full items-center justify-center text-rose-500">
              加载失败：{error}
            </div>
          )}

          {!loading && !error && data?.candles.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <p>暂无 {PERIODS.find((p) => p.key === activePeriod)?.label} 数据</p>
              {data?.error && <p className="mt-2 text-xs text-slate-300">{data.error}</p>}
            </div>
          )}

          {!loading && option && (
            <ReactECharts option={option} style={{ height: '100%', minHeight: '50vh', width: '100%' }} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
          <span>数据源：{data?.source || '—'}</span>
          <span>更新时间：{data ? new Date(data.lastUpdated).toLocaleString('zh-CN') : '—'}</span>
        </div>
      </div>
    </div>
  )
}
