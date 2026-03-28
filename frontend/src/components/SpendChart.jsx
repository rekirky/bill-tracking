import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getSpendChart } from '../api.js'
import { fmt } from '../utils.js'

function buildChartData(previous, current) {
  const today = new Date()

  // Build lookup maps: day -> { cumulative, bills[] }
  const prevMap = {}
  for (const p of previous) {
    prevMap[p.day] = { cumulative: p.cumulative, label: p.bill, amount: p.amount }
  }
  const currMap = {}
  for (const p of current) {
    currMap[p.day] = { cumulative: p.cumulative, label: p.bill, amount: p.amount }
  }

  const data = []
  let prevCum = 0
  let currCum = 0

  for (let day = 1; day <= 31; day++) {
    if (prevMap[day]) prevCum = prevMap[day].cumulative
    if (currMap[day]) currCum = currMap[day].cumulative

    const point = { day, prev: prevCum }
    if (day <= today.getDate()) point.curr = currCum

    // Attach payment info for tooltip
    if (prevMap[day]) point.prevBill = `${prevMap[day].label} — ${fmt(prevMap[day].amount)}`
    if (currMap[day]) point.currBill = `${currMap[day].label} — ${fmt(currMap[day].amount)}`

    data.push(point)
  }

  return data
}

function CustomTooltip({ active, payload, label, prevLabel, currLabel }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border2)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: 'var(--text2)', marginBottom: 6 }}>Day {label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          <span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(entry.value)}</span>
          <span style={{ color: 'var(--text2)', marginLeft: 6 }}>
            {entry.dataKey === 'prev' ? prevLabel : currLabel}
          </span>
          {entry.dataKey === 'prev' && entry.payload.prevBill && (
            <div style={{ color: 'var(--text2)', marginTop: 2 }}>{entry.payload.prevBill}</div>
          )}
          {entry.dataKey === 'curr' && entry.payload.currBill && (
            <div style={{ color: 'var(--text2)', marginTop: 2 }}>{entry.payload.currBill}</div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function SpendChart() {
  const [chartData, setChartData] = useState(null)

  useEffect(() => {
    getSpendChart().then(setChartData)
  }, [])

  if (!chartData) return null

  const data = buildChartData(chartData.previous, chartData.current)
  return (
    <div className="card" style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 20 }}>Monthly spend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5c6480" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5c6480" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="currGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f7cff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f7cff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--text3)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            tick={{ fill: 'var(--text3)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<CustomTooltip prevLabel={chartData.previous_month} currLabel={chartData.current_month} />}
          />
          <Legend
            formatter={(value) => value === 'prev' ? chartData.previous_month : chartData.current_month}
            wrapperStyle={{ fontSize: 12, color: 'var(--text2)', paddingTop: 12 }}
          />
          <Area
            type="stepAfter"
            dataKey="prev"
            stroke="#5c6480"
            strokeWidth={1.5}
            fill="url(#prevGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#5c6480' }}
            connectNulls
          />
          <Area
            type="stepAfter"
            dataKey="curr"
            stroke="#4f7cff"
            strokeWidth={2}
            fill="url(#currGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#4f7cff' }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
