import ReactECharts from 'echarts-for-react'

export default function IntradayChart({ data, changePercent }) {
  if (!data || data.candles.length === 0) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        暂无分时数据
      </div>
    )
  }

  const times = data.candles.map((c) => c.time)
  const closes = data.candles.map((c) => c.close)
  const firstClose = closes[0]
  const lastClose = closes[closes.length - 1]
  const isUp = lastClose >= firstClose
  const lineColor =
    changePercent > 0 ? '#ef4444' : changePercent < 0 ? '#22c55e' : '#64748b'

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
      data: times,
      show: false,
    },
    yAxis: {
      type: 'value',
      show: false,
      scale: true,
      min: Math.min(...closes) * 0.999,
      max: Math.max(...closes) * 1.001,
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        return `${p.name}<br/>收盘: ${p.value.toFixed(2)}`
      },
    },
    series: [
      {
        type: 'line',
        data: closes,
        smooth: true,
        showSymbol: false,
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
