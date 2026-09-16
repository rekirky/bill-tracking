import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getAccounts, getTransactionTags, getSpendOverTime } from '../api.js'
import { fmt, fmtDate } from '../utils.js'
import MultiSelect from '../components/MultiSelect.jsx'

function periodLabel(period, granularity) {
  const d = new Date(period + 'T00:00:00')
  if (granularity === 'month') {
    return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  }
  return fmtDate(period)
}

export default function Spending() {
  const [accounts, setAccounts] = useState([])
  const [tags, setTags] = useState([])
  const [accountIds, setAccountIds] = useState([])
  const [tagIds, setTagIds] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getAccounts().then(setAccounts)
    getTransactionTags().then(setTags)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (accountIds.length) params.account_id = accountIds
    if (tagIds.length) params.tag_id = tagIds
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return getSpendOverTime(params).then(setData).finally(() => setLoading(false))
  }, [accountIds, tagIds, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const chartData = (data?.points || []).map((p) => ({
    label: periodLabel(p.period, data.granularity),
    amount: p.amount,
  }))
  const total = chartData.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Spending Over Time</h1>
          <p className="text-muted mt-8">Track spend by tag, account, and date range.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid form-grid-3">
          <div className="field">
            <label>Accounts</label>
            <MultiSelect label="accounts" options={accounts} selected={accountIds} onChange={setAccountIds} />
          </div>
          <div className="field">
            <label>Tags</label>
            <MultiSelect label="tags" options={tags} selected={tagIds} onChange={setTagIds} />
          </div>
          <div />
          <div className="field">
            <label>From date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3>Spend {data?.granularity === 'month' ? 'per month' : 'per day'}</h3>
          <span className="text-muted">Total: <strong className="mono">{fmt(total)}</strong></span>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : chartData.length === 0 ? (
          <div className="empty-state"><p>No spending in this range.</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text3)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fill: 'var(--text3)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text2)' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#4f7cff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
