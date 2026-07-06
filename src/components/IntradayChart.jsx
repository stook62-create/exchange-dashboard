import ReactECharts from 'echarts-for-react'
import { alignIntradayData } from '../utils/marketHours.js'

export default function IntradayChart({ data, changePercent }) {
  if (!data || data.candles.length === 0) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        暂无分时数据
      </div>
    )
  }

  const region = data.region || 'US'
  const { categories, values } = alignIntradayData(data.candles, region)
  const nonNullValues = values.filter((v) => v != null)

  if (nonNullValues.length === 0) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        暂无分时数据
      </div>
    )
  }

  const firstClose = nonNullValues[0]
  const lastClose = nonNullValues[nonNullValues.length - 1]
  const isUp = lastClose >= firstClose
  const lineColor =
    changePercent > 0 ? '#ef4444' : changePercent < 0 ? '#22c55e' : '#64748b'

  const minValue = Math.min(...nonNullValues)
  const maxValue = Math.max(...nonNullValues)
  const padding = maxValue === minValue ? Math.abs(minValue) * 0.01 || 1 : (maxValue - minValue) * 0.05

  const option = {
    animation: false,
    grid: {
      top: 4,
      right: 4,
      bottom: 4,
      left: 4,
    },
    xAxis: {
      type: 'category',
      data: categories,
      show: false,
    },
    yAxis: {
      type: 'value',
      show: false,
      scale: true,
      min: minValue - padding,
      max: maxValue + padding,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        const value = p.value
        if (value == null) return `${p.name}`
        return `${p.name}<br/>收盘: ${Number(value).toFixed(2)}`
      },
    },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: false,
        connectNulls: false,
        lineStyle: {
          color: lineColor,
          width: 2,
        },
        itemStyle: {
          color: lineColor,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: isUp ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)' },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ],
          },
        },
      },
    ],
  }

  return (
    <div className="mt-3 h-16 w-full">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
