import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getWealthDashboard } from '../api.js'

const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function fmtChange(current, previous) {
  if (previous == null || current == null) return null
  const diff = current - previous
  const sign = diff >= 0 ? '+' : ''
  return { label: `${sign}${fmt(diff)}`, positive: diff >= 0 }
}

function SummaryCard({ label, value, previous, color }) {
  const change = fmtChange(value, previous)
  return (
    <div className="wealth-stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value mono${color ? ' ' + color : ''}`}>{fmt(value)}</div>
      {change && (
        <div className={`wealth-change ${change.positive ? 'positive' : 'negative'}`}>
          {change.label} vs prev month
        </div>
      )}
      {!change && <div className="wealth-change neutral">No previous data</div>}
    </div>
  )
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text3)', fontSize: 11 }}>Not enough data</span>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={50}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color || 'var(--accent)'}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TagPill({ tag }) {
  return (
    <span
      className="wealth-tag-pill"
      style={{
        backgroundColor: tag.color + '22',
        borderColor: tag.color + '55',
        color: tag.color,
      }}
    >
      <span className="wealth-tag-dot" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  )
}

function PinnedCard({ item }) {
  const change = fmtChange(item.current_value, item.previous_value)
  const sparkColor = item.type === 'asset' ? 'var(--green)' : 'var(--red)'

  return (
    <div className="wealth-pinned-card">
      <div className="wealth-pinned-card-header">
        <span className="wealth-pinned-name">{item.name}</span>
        <span className={`badge ${item.type === 'asset' ? 'type-badge-asset' : 'type-badge-liability'}`}>
          {item.type}
        </span>
      </div>
      <div className="wealth-pinned-value">{fmt(item.current_value)}</div>
      {change && (
        <div className={`wealth-change ${change.positive ? 'positive' : 'negative'}`} style={{ fontSize: 11 }}>
          {change.label} vs prev month
        </div>
      )}
      <Sparkline data={item.sparkline} color={sparkColor} />
      {item.tags.length > 0 && (
        <div className="wealth-pinned-tags">
          {item.tags.map(t => <TagPill key={t.id} tag={t} />)}
        </div>
      )}
    </div>
  )
}

function ComparisonTable({ title, items, prevLabel, currLabel, isLiability }) {
  if (!items || items.length === 0) return null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3>{title}</h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tags</th>
              <th style={{ textAlign: 'right' }}>{prevLabel || 'Previous'}</th>
              <th style={{ textAlign: 'right' }}>{currLabel || 'Current'}</th>
              <th style={{ textAlign: 'right' }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const curr = item.current_value
              const prev = item.previous_value
              const diff = curr != null && prev != null ? curr - prev : null
              // For assets: up = green, down = red
              // For liabilities: down = green, up = red
              let changeColor = 'var(--text2)'
              if (diff != null && diff !== 0) {
                const isPositive = diff > 0
                changeColor = (isPositive !== isLiability) ? 'var(--green)' : 'var(--red)'
              }
              const sign = diff != null && diff > 0 ? '+' : ''

              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {item.tags.map(t => <TagPill key={t.id} tag={t} />)}
                    </div>
                  </td>
                  <td className="mono text-right" style={{ color: 'var(--text2)' }}>
                    {prev != null ? fmt(prev) : '—'}
                  </td>
                  <td className="mono text-right" style={{ color: changeColor }}>
                    {curr != null ? fmt(curr) : '—'}
                  </td>
                  <td className="mono text-right" style={{ color: changeColor }}>
                    {diff != null ? `${sign}${fmt(diff)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetWorthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border2)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: 'var(--text2)', marginBottom: 6 }}>{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} style={{ color: entry.color, marginBottom: 2 }}>
          <span style={{ fontFamily: 'DM Mono, monospace' }}>{fmt(entry.value)}</span>
          <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{entry.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function WealthDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getWealthDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page"><p className="text-muted">Loading…</p></div>
  if (error) return <div className="page"><p className="text-red">{error}</p></div>

  const hasHistory = data.history.length > 0
  const hasPinned = data.pinned_items.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>Asset Tracking</h1>
        <span className="text-muted" style={{ fontSize: 13 }}>Net wealth overview</span>
      </div>

      {/* Summary cards */}
      <div className="wealth-summary-grid">
        <SummaryCard
          label="Net Worth"
          value={data.current_net_worth}
          previous={data.previous_net_worth}
          color={data.current_net_worth >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label="Total Assets"
          value={data.current_assets}
          previous={data.previous_assets}
          color="green"
        />
        <SummaryCard
          label="Total Liabilities"
          value={data.current_liabilities}
          previous={data.previous_liabilities}
          color="red"
        />
      </div>

      {/* Net worth history chart */}
      {hasHistory ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 20 }}>Net worth history</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd87a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2dd87a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff5c5c" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ff5c5c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f7cff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4f7cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text3)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: 'var(--text3)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<NetWorthTooltip />} />
              <Area type="monotone" dataKey="assets" name="Assets" stroke="#2dd87a" strokeWidth={1.5} fill="url(#assetsGrad)" dot={false} />
              <Area type="monotone" dataKey="liabilities" name="Liabilities" stroke="#ff5c5c" strokeWidth={1.5} fill="url(#liabGrad)" dot={false} />
              <Area type="monotone" dataKey="net_worth" name="Net Worth" stroke="#4f7cff" strokeWidth={2} fill="url(#nwGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 32 }}>
          <div className="empty-state">
            <p>No snapshot data yet.</p>
            <p>Go to <strong>Items &amp; Values</strong> to add your assets and liabilities, then enter monthly values.</p>
          </div>
        </div>
      )}

      {/* Month-on-month comparison tables */}
      {(data.asset_comparisons.length > 0 || data.liability_comparisons.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          <ComparisonTable
            title="Assets"
            items={data.asset_comparisons}
            prevLabel={data.previous_month_label}
            currLabel={data.current_month_label}
            isLiability={false}
          />
          <ComparisonTable
            title="Liabilities"
            items={data.liability_comparisons}
            prevLabel={data.previous_month_label}
            currLabel={data.current_month_label}
            isLiability={true}
          />
        </div>
      )}

      {/* Pinned items */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>Pinned items</h3>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {hasPinned ? 'Manage which items appear here in Items & Values' : 'Pin items in Items & Values → toggle the dashboard star'}
        </span>
      </div>

      {hasPinned ? (
        <div className="wealth-pinned-grid">
          {data.pinned_items.map(item => <PinnedCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <p>No pinned items yet.</p>
            <p>In <strong>Items &amp; Values</strong>, toggle the star on any item to pin it here.</p>
          </div>
        </div>
      )}
    </div>
  )
}
