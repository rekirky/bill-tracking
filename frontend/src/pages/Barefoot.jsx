import { useEffect, useState, useCallback, useRef } from 'react'
import Modal from '../components/Modal.jsx'
import {
  getBarefootDashboard,
  upsertBarefootEntry,
  getBarefootIncome, createBarefootIncome, updateBarefootIncome, deleteBarefootIncome,
  getFireGoals, createFireGoal, updateFireGoal, deleteFireGoal, celebrateFireGoal,
  createFireAllocation, deleteFireAllocation,
  createBucketTransaction, deleteBucketTransaction,
  createDailyExpense, deleteDailyExpense,
  updateBarefootSettings,
  getLinkableLiabilities,
} from '../api.js'

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

const BUCKETS = {
  daily:  { label: 'Daily Expenses',    emoji: '🏠', color: '#4f7cff', pct: 60, desc: 'Everyday living costs' },
  splurge:{ label: 'Splurge',           emoji: '🎉', color: '#f5a623', pct: 10, desc: 'Fun money — no guilt!' },
  smile:  { label: 'Smile',             emoji: '😊', color: '#2dd87a', pct: 10, desc: 'Long-term security fund' },
  fire:   { label: 'Fire Extinguisher', emoji: '🔥', color: '#ff5c5c', pct: 20, desc: 'Pay off debts & save for bills' },
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function fmt(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function fmtDec(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

// ── Celebration ───────────────────────────────────────────

const PARTY_COLORS = ['#ff5c5c','#f5a623','#2dd87a','#4f7cff','#a855f7','#ec4899','#06b6d4','#fbbf24']

function Celebration({ goalName, onClose }) {
  const particles = useRef([])

  useEffect(() => {
    // generate 60 particles at random positions
    particles.current = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      color: PARTY_COLORS[i % PARTY_COLORS.length],
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      tx: (Math.random() - 0.5) * 300,
      ty: (Math.random() - 0.5) * 300,
      dur: 0.8 + Math.random() * 0.8,
      delay: Math.random() * 0.5,
      size: 6 + Math.random() * 10,
    }))
  }, [])

  return (
    <div className="bf-celebration-overlay" onClick={onClose}>
      {particles.current.map(p => (
        <div
          key={p.id}
          className="bf-particle"
          style={{
            left: p.x, top: p.y,
            width: p.size, height: p.size,
            background: p.color,
            '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
            '--dur': `${p.dur}s`, '--delay': `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
      <div className="bf-celebration-box" onClick={e => e.stopPropagation()}>
        <span className="bf-celebration-emoji">🎊</span>
        <div className="bf-celebration-title">You crushed it!</div>
        <div className="bf-celebration-sub">
          <strong style={{ color: 'var(--text)' }}>{goalName}</strong> is paid off.<br />
          That's one less thing holding you back. 🔥
        </div>
        <button className="btn btn-primary w-full" onClick={onClose} style={{ fontSize: 15, padding: '12px' }}>
          Let's keep going! 💪
        </button>
      </div>
    </div>
  )
}

// ── Bucket Card ───────────────────────────────────────────

function BucketCard({ bucket, config, target, deposited, runningTotal, year, month, onSaved, pct: ratioPct }) {
  const [value, setValue] = useState(deposited != null ? String(deposited) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(deposited != null ? String(deposited) : '')
    setSaved(false)
  }, [deposited, year, month])

  const pct = target > 0 ? Math.min(100, (parseFloat(value) || deposited || 0) / target * 100) : 0
  const displayPct = Math.round(pct)

  async function handleSave() {
    const amount = parseFloat(value)
    if (isNaN(amount) || amount < 0) return
    setSaving(true)
    try {
      await upsertBarefootEntry({ bucket, year, month, amount })
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="bf-bucket-card"
      style={{
        '--bucket-color': config.color,
        background: `color-mix(in srgb, ${config.color} 5%, var(--bg2))`,
        border: `1px solid color-mix(in srgb, ${config.color} 25%, var(--border))`,
      }}
    >
      <div className="bf-bucket-header">
        <div className="bf-bucket-title">
          <span className="bf-bucket-emoji">{config.emoji}</span>
          <div>
            <div className="bf-bucket-name">{config.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{config.desc}</div>
          </div>
        </div>
        <span className="bf-bucket-pct">{ratioPct ?? config.pct}%</span>
      </div>

      <div className="bf-bucket-amounts">
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Target / month</div>
          <div className="bf-bucket-amount-value">{fmt(target)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Deposited</div>
          <div className="bf-bucket-amount-value accent">{fmt(deposited)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">All-time total</div>
          <div className="bf-bucket-amount-value">{fmt(runningTotal)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">
            {deposited != null && deposited >= target ? 'Over by' : 'To go'}
          </div>
          <div className="bf-bucket-amount-value" style={{
            color: deposited == null ? 'var(--text3)'
              : deposited >= target ? '#2dd87a' : 'var(--amber)'
          }}>
            {deposited != null && target > 0
              ? fmt(Math.abs(target - (deposited || 0)))
              : '—'}
          </div>
        </div>
      </div>

      <div className="bf-progress-track">
        <div className="bf-progress-fill" style={{ width: `${displayPct}%` }} />
      </div>
      <div className="bf-progress-meta">
        <span>{fmt(deposited || 0)} deposited</span>
        <span>{fmt(target)} target</span>
      </div>

      <div className="bf-bucket-input-row">
        <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>$ this month</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="0"
        />
        <button className="bf-save-btn" onClick={handleSave} disabled={saving} style={{ '--bucket-color': config.color }}>
          {saved ? '✓ Saved' : saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Daily Expenses Card ───────────────────────────────────

const PREVIEW_COUNT = 5

function DailyBucketCard({ data, onSaved }) {
  const config = BUCKETS.daily
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [billsExpanded, setBillsExpanded] = useState(false)
  const [expensesExpanded, setExpensesExpanded] = useState(false)

  const target = data.targets.daily
  const calculated = data.daily_calculated
  const pct = target > 0 ? Math.min(100, (calculated / target) * 100) : 0
  const displayPct = Math.round(pct)

  async function handleAddExpense(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!desc.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    try {
      await createDailyExpense({ year: data.year, month: data.month, description: desc.trim(), amount: amt })
      setDesc('')
      setAmount('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteExpense(id) {
    await deleteDailyExpense(id)
    onSaved()
  }

  return (
    <div
      className="bf-bucket-card"
      style={{
        '--bucket-color': config.color,
        background: `color-mix(in srgb, ${config.color} 5%, var(--bg2))`,
        border: `1px solid color-mix(in srgb, ${config.color} 25%, var(--border))`,
      }}
    >
      <div className="bf-bucket-header">
        <div className="bf-bucket-title">
          <span className="bf-bucket-emoji">{config.emoji}</span>
          <div>
            <div className="bf-bucket-name">{config.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{config.desc}</div>
          </div>
        </div>
        <span className="bf-bucket-pct">{data.settings.pct_daily}%</span>
      </div>

      {/* Totals row */}
      <div className="bf-bucket-amounts">
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Target / month</div>
          <div className="bf-bucket-amount-value">{fmt(target)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Bills paid</div>
          <div className="bf-bucket-amount-value" style={{ color: config.color }}>
            {fmt(data.bills_paid_this_month.reduce((s, b) => s + b.amount_paid, 0))}
          </div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Once-off</div>
          <div className="bf-bucket-amount-value" style={{ color: config.color }}>
            {fmt(data.daily_expenses_this_month.reduce((s, e) => s + e.amount, 0))}
          </div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">{calculated >= target ? 'Over by' : 'To go'}</div>
          <div className="bf-bucket-amount-value" style={{ color: calculated >= target ? '#2dd87a' : 'var(--amber)' }}>
            {fmt(Math.abs(target - calculated))}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bf-progress-track">
        <div className="bf-progress-fill" style={{ width: `${displayPct}%` }} />
      </div>
      <div className="bf-progress-meta">
        <span>{fmt(calculated)} spent</span>
        <span>{fmt(target)} target · {displayPct}%</span>
      </div>

      {/* Bills paid this month */}
      {data.bills_paid_this_month.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bills paid this month
            </div>
            {data.bills_paid_this_month.length > PREVIEW_COUNT && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setBillsExpanded(x => !x)}
              >
                {billsExpanded ? 'Show less' : `Show all (${data.bills_paid_this_month.length})`}
              </button>
            )}
          </div>
          {(billsExpanded ? data.bills_paid_this_month : data.bills_paid_this_month.slice(-PREVIEW_COUNT)).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{b.bill_name}</span>
              <span className="mono" style={{ color: config.color }}>{fmt(b.amount_paid)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Once-off expenses */}
      {data.daily_expenses_this_month.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Once-off expenses
            </div>
            {data.daily_expenses_this_month.length > PREVIEW_COUNT && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setExpensesExpanded(x => !x)}
              >
                {expensesExpanded ? 'Show less' : `Show all (${data.daily_expenses_this_month.length})`}
              </button>
            )}
          </div>
          {(expensesExpanded ? data.daily_expenses_this_month : data.daily_expenses_this_month.slice(-PREVIEW_COUNT)).map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{e.description}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ color: config.color }}>{fmt(e.amount)}</span>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => handleDeleteExpense(e.id)}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add once-off expense */}
      <form onSubmit={handleAddExpense} style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Description"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          style={{ flex: 2, fontSize: 12 }}
        />
        <input
          type="number"
          placeholder="$0"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ flex: 1, fontSize: 12 }}
        />
        <button type="submit" className="bf-save-btn" disabled={saving} style={{ '--bucket-color': config.color, whiteSpace: 'nowrap' }}>
          {saving ? '…' : '+ Add'}
        </button>
      </form>
    </div>
  )
}

// ── Splurge Calculated Card ───────────────────────────────

function SplurgeBucketCard({ data }) {
  const config = BUCKETS.splurge
  const splurge = data.splurge_calculated
  const smileDeposited = data.this_month_deposits['smile'] ?? 0
  const fireDeposited = data.this_month_deposits['fire'] ?? 0

  return (
    <div
      className="bf-bucket-card"
      style={{
        '--bucket-color': config.color,
        background: `color-mix(in srgb, ${config.color} 5%, var(--bg2))`,
        border: `1px solid color-mix(in srgb, ${config.color} 25%, var(--border))`,
      }}
    >
      <div className="bf-bucket-header">
        <div className="bf-bucket-title">
          <span className="bf-bucket-emoji">{config.emoji}</span>
          <div>
            <div className="bf-bucket-name">{config.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{config.desc}</div>
          </div>
        </div>
        <span className="bf-bucket-pct">calculated</span>
      </div>

      <div style={{ margin: '12px 0', padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Current splurge
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: splurge >= 0 ? config.color : '#ff5c5c', fontWeight: 700 }}>
          {fmt(splurge)}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text3)' }}>Monthly income</span>
          <span className="mono">{fmt(data.monthly_income)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text3)' }}>− Bills</span>
          <span className="mono" style={{ color: '#ff5c5c' }}>−{fmt(data.monthly_bills_total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text3)' }}>− Smile deposited</span>
          <span className="mono" style={{ color: smileDeposited > 0 ? '#ff5c5c' : 'var(--text3)' }}>
            −{fmt(smileDeposited)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text3)' }}>− Fire deposited</span>
          <span className="mono" style={{ color: fireDeposited > 0 ? '#ff5c5c' : 'var(--text3)' }}>
            −{fmt(fireDeposited)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontWeight: 600 }}>= Splurge remaining</span>
          <span className="mono" style={{ fontWeight: 700, color: splurge >= 0 ? config.color : '#ff5c5c' }}>{fmt(splurge)}</span>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
        Fills automatically as smile & fire buckets are deposited throughout the month.
      </div>
    </div>
  )
}

// ── Smile Security Card ───────────────────────────────────

function SmileSecurityCard({ data, onSettingsChange }) {
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState(String(data.smile_months_target))
  const [saving, setSaving] = useState(false)

  const achieved = data.smile_months_achieved
  const target = data.smile_months_target
  const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0
  const monthsFloor = Math.floor(achieved)

  async function saveTarget() {
    const val = parseInt(targetInput)
    if (isNaN(val) || val < 1) return
    setSaving(true)
    try {
      await updateBarefootSettings({ smile_months_target: val })
      setEditingTarget(false)
      onSettingsChange()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bf-smile-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ color: 'var(--text2)', marginBottom: 2 }}>😊 Smile — Financial Security</h3>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Based on {fmt(data.monthly_bills_total)}/month in recurring bills
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Balance</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#2dd87a' }}>{fmt(data.smile_balance)}</div>
        </div>
      </div>

      <div className="bf-months-stat">
        <span className="bf-months-big">{monthsFloor}</span>
        <span className="bf-months-label">
          month{monthsFloor !== 1 ? 's' : ''} of security
          {achieved > 0 && achieved < 1 && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>({achieved.toFixed(1)} months)</span>}
        </span>
      </div>

      <div className="bf-security-bar-wrap" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>0 months</span>
          <span>
            Target:{' '}
            {editingTarget ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number" min="1" max="24"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false) }}
                  style={{ width: 48, padding: '1px 6px', fontSize: 11 }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={saveTarget} disabled={saving} style={{ padding: '2px 8px', fontSize: 11 }}>
                  {saving ? '…' : 'Set'}
                </button>
              </span>
            ) : (
              <span
                style={{ color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline dotted' }}
                onClick={() => setEditingTarget(true)}
              >
                {target} month{target !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
        <div className="bf-security-track">
          <div className="bf-security-fill" style={{ width: `${pct}%` }}>
            {pct > 15 && (
              <span className="bf-security-fill-label">{achieved.toFixed(1)}mo</span>
            )}
          </div>
        </div>
      </div>

      {achieved < target && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(245,166,35,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
          {fmt(data.monthly_bills_total * (target - achieved))} more needed to reach {target} months of security
        </div>
      )}
      {achieved >= target && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(45,216,122,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
          🎉 You've hit your {target}-month security target! Consider increasing your goal.
        </div>
      )}
    </div>
  )
}

// ── Add Allocation Modal ──────────────────────────────────

function AllocationModal({ goal, onClose, onSave }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      await createFireAllocation({ fire_goal_id: goal.id, year, month, amount: amt, notes: notes || null })
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>Add Allocation — {goal.name}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--text2)' }}>Remaining: </span>
        <span style={{ color: '#ff5c5c', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{fmt(goal.remaining)}</span>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Year</label>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min="2020" max="2040" />
          </div>
        </div>
        <div className="field">
          <label>Amount ($)</label>
          <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Monthly repayment" />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add allocation'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Fire Goal Form Modal ──────────────────────────────────

function FireGoalModal({ goal, isSlushBill, prefillLiability, onClose, onSave }) {
  const slush = isSlushBill ?? goal?.is_slush_bill ?? false

  const [name, setName] = useState(goal?.name || prefillLiability?.name || '')
  const [totalOwed, setTotalOwed] = useState(
    goal?.total_owed != null ? String(goal.total_owed)
    : prefillLiability?.latest_value != null ? String(prefillLiability.latest_value)
    : ''
  )
  const [priority, setPriority] = useState(goal?.priority || 'medium')
  const [dueDate, setDueDate] = useState(goal?.due_date || '')
  const [notes, setNotes] = useState(goal?.notes || '')
  const [linkedId, setLinkedId] = useState(
    goal?.wealth_item_id ?? prefillLiability?.id ?? null
  )
  const [linkableLiabilities, setLinkableLiabilities] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Only load linkable liabilities for new debt goals (not slush, not editing a linked goal)
    if (!slush && !goal?.wealth_item_id) {
      getLinkableLiabilities().then(setLinkableLiabilities).catch(() => {})
    }
  }, [slush, goal])

  // When a liability is selected, auto-fill name + amount
  function handleLiabilitySelect(e) {
    const id = e.target.value ? Number(e.target.value) : null
    setLinkedId(id)
    if (id) {
      const lib = linkableLiabilities.find(l => l.id === id)
      if (lib) {
        if (!name || name === '') setName(lib.name)
        if (!totalOwed && lib.latest_value != null) setTotalOwed(String(lib.latest_value))
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseFloat(totalOwed)
    if (!name.trim()) { setError('Name is required'); return }
    // Amount not required if linking — backend will pull from snapshot
    if (!linkedId && (isNaN(amt) || amt <= 0)) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        total_owed: linkedId ? (parseFloat(totalOwed) || 0) : amt,
        priority,
        due_date: dueDate || null,
        notes: notes || null,
        is_slush_bill: slush,
        wealth_item_id: linkedId || null,
      }
      if (goal) { await updateFireGoal(goal.id, payload) }
      else { await createFireGoal(payload) }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const title = goal ? 'Edit Goal' : slush ? 'New Slush Bill' : 'New Debt Goal'

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">

        {/* Liability link — only for debt goals */}
        {!slush && !goal?.wealth_item_id && linkableLiabilities.length > 0 && (
          <div className="field">
            <label>Link to Asset Tracker liability <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
            <select value={linkedId ?? ''} onChange={handleLiabilitySelect}>
              <option value="">— Manual goal —</option>
              {linkableLiabilities.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.latest_value != null ? ` — $${Math.round(l.latest_value).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
            {linkedId && (
              <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                ✓ Remaining will update automatically from your monthly wealth snapshots
              </p>
            )}
          </div>
        )}

        {/* Show linked badge when editing an already-linked goal */}
        {goal?.is_linked && (
          <div style={{ padding: '10px 14px', background: 'rgba(79,124,255,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
            📊 Linked to <strong>{goal.linked_item_name}</strong> — remaining balance updates from your monthly wealth snapshot
          </div>
        )}

        <div className="field">
          <label>{slush ? 'Bill name' : 'Debt name'}</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={slush ? 'e.g. Car service' : 'e.g. HECS Debt'} autoFocus />
        </div>
        {!linkedId && (
          <div className="field">
            <label>{slush ? 'Amount ($)' : 'Total owed ($)'}</label>
            <input type="number" step="0.01" min="0.01" value={totalOwed} onChange={e => setTotalOwed(e.target.value)} placeholder="0.00" />
          </div>
        )}
        {!slush && (
          <div className="field">
            <label>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="high">High 🔴</option>
              <option value="medium">Medium 🟡</option>
              <option value="low">Low 🟢</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>Due date <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Notes <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any extra details" />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : goal ? 'Save changes' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Fire Goal Card ────────────────────────────────────────

function FireGoalCard({ goal, onRefresh, onCelebrate }) {
  const [expanded, setExpanded] = useState(false)
  const [addAlloc, setAddAlloc] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pct = goal.progress_pct
  const isPaidOff = goal.is_paid_off

  async function handleDelete() {
    if (!confirm(`Delete "${goal.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try { await deleteFireGoal(goal.id); onRefresh() }
    finally { setDeleting(false) }
  }

  async function handleCelebrate() {
    await celebrateFireGoal(goal.id)
    onCelebrate(goal.name)
    onRefresh()
  }

  async function handleDeleteAlloc(id) {
    await deleteFireAllocation(id)
    onRefresh()
  }

  return (
    <div className="bf-goal-card" style={{ opacity: isPaidOff ? 0.6 : 1 }}>
      <div className="bf-goal-header">
        <span className="bf-goal-name">
          {goal.is_slush_bill ? '💸 ' : ''}{goal.name}
          {isPaidOff && <span style={{ marginLeft: 8, color: 'var(--green)', fontSize: 12 }}>✓ Paid off</span>}
        </span>
        {goal.is_linked && (
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 20,
            background: 'rgba(79,124,255,0.15)', color: 'var(--accent)',
          }}>
            📊 Linked
          </span>
        )}
        {!goal.is_slush_bill && (
          <span className={`bf-priority-badge bf-priority-${goal.priority}`}>{goal.priority}</span>
        )}
        {goal.due_date && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            Due {new Date(goal.due_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className="bf-goal-meta">
        <span>Original: <strong>{fmt(goal.total_owed)}</strong></span>
        <span>
          {goal.is_linked ? 'Fire payments: ' : 'Paid: '}
          <strong style={{ color: 'var(--green)' }}>{fmt(goal.total_allocated)}</strong>
        </span>
        <span>
          {goal.is_linked ? 'Current balance: ' : 'Remaining: '}
          <strong style={{ color: goal.remaining > 0 ? '#ff5c5c' : 'var(--green)' }}>{fmt(goal.remaining)}</strong>
          {goal.is_linked && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>(from tracker)</span>}
        </span>
        {goal.notes && <span style={{ color: 'var(--text3)' }}>{goal.notes}</span>}
      </div>

      <div className="bf-goal-progress-track">
        <div className={`bf-goal-progress-fill${pct >= 100 ? ' complete' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
        <span>{pct}% complete</span>
        {pct >= 100 && !isPaidOff && <span style={{ color: 'var(--green)' }}>🎯 Ready to mark as paid!</span>}
      </div>

      <div className="bf-goal-actions">
        {!isPaidOff && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddAlloc(true)}>+ Allocate</button>
            {pct >= 100 && (
              <button className="btn btn-sm" style={{ background: '#2dd87a', color: '#000', fontWeight: 700 }} onClick={handleCelebrate}>
                🎉 Mark as paid!
              </button>
            )}
          </>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(x => !x)}>
          {expanded ? 'Hide' : `History (${goal.allocations.length})`}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditModal(true)}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>Delete</button>
      </div>

      {expanded && (
        <div className="bf-goal-allocations">
          {goal.allocations.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: 12, padding: '4px 0' }}>No allocations yet.</p>
          ) : (
            goal.allocations.map(a => (
              <div key={a.id} className="bf-allocation-row">
                <span style={{ color: 'var(--text2)' }}>
                  {MONTH_NAMES[a.month - 1].slice(0,3)} {a.year}
                  {a.notes && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>— {a.notes}</span>}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono" style={{ color: 'var(--green)' }}>{fmtDec(a.amount)}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => handleDeleteAlloc(a.id)}
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {addAlloc && <AllocationModal goal={goal} onClose={() => setAddAlloc(false)} onSave={() => { setAddAlloc(false); onRefresh() }} />}
      {editModal && <FireGoalModal goal={goal} onClose={() => setEditModal(false)} onSave={() => { setEditModal(false); onRefresh() }} />}
    </div>
  )
}

// ── Transaction Bucket Card (Smile / Fire) ────────────────

function TransactionBucketCard({ bucket, config, target, transactions, runningTotal, year, month, onSaved, pct: ratioPct }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [txExpanded, setTxExpanded] = useState(false)

  const monthTotal = transactions.reduce((s, t) => s + t.amount, 0)
  const displayTotal = Math.round(monthTotal * 100) / 100
  const pct = target > 0 ? Math.min(100, (displayTotal / target) * 100) : 0
  const displayPct = Math.round(pct)

  async function handleAdd(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt === 0) return
    setSaving(true)
    try {
      await createBucketTransaction({ bucket, year, month, amount: amt, notes: notes.trim() || null })
      setAmount('')
      setNotes('')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteBucketTransaction(id)
    onSaved()
  }

  return (
    <div
      className="bf-bucket-card"
      style={{
        '--bucket-color': config.color,
        background: `color-mix(in srgb, ${config.color} 5%, var(--bg2))`,
        border: `1px solid color-mix(in srgb, ${config.color} 25%, var(--border))`,
      }}
    >
      <div className="bf-bucket-header">
        <div className="bf-bucket-title">
          <span className="bf-bucket-emoji">{config.emoji}</span>
          <div>
            <div className="bf-bucket-name">{config.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{config.desc}</div>
          </div>
        </div>
        <span className="bf-bucket-pct">{ratioPct ?? config.pct}%</span>
      </div>

      <div className="bf-bucket-amounts">
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">Target / month</div>
          <div className="bf-bucket-amount-value">{fmt(target)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">This month</div>
          <div className="bf-bucket-amount-value accent">{fmt(displayTotal)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">All-time total</div>
          <div className="bf-bucket-amount-value">{fmt(runningTotal)}</div>
        </div>
        <div className="bf-bucket-amount-item">
          <div className="bf-bucket-amount-label">{displayTotal >= target ? 'Over by' : 'To go'}</div>
          <div className="bf-bucket-amount-value" style={{ color: displayTotal >= target ? '#2dd87a' : 'var(--amber)' }}>
            {target > 0 ? fmt(Math.abs(target - displayTotal)) : '—'}
          </div>
        </div>
      </div>

      <div className="bf-progress-track">
        <div className="bf-progress-fill" style={{ width: `${displayPct}%` }} />
      </div>
      <div className="bf-progress-meta">
        <span>{fmt(displayTotal)} saved</span>
        <span>{fmt(target)} target · {displayPct}%</span>
      </div>

      {/* Transaction log */}
      {transactions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              This month
            </div>
            {transactions.length > PREVIEW_COUNT && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setTxExpanded(x => !x)}
              >
                {txExpanded ? 'Show less' : `Show all (${transactions.length})`}
              </button>
            )}
          </div>
          {(txExpanded ? transactions : transactions.slice(-PREVIEW_COUNT)).map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>
                {t.notes || (t.amount >= 0 ? 'Deposit' : 'Withdrawal')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ color: t.amount >= 0 ? config.color : '#ff5c5c', fontWeight: 600 }}>
                  {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                </span>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => handleDelete(t.id)}
                >✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 2px', fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: 'var(--text3)' }}>Running total</span>
            <span className="mono" style={{ color: config.color }}>{fmt(displayTotal)}</span>
          </div>
        </div>
      )}

      {/* Add entry */}
      <form onSubmit={handleAdd} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13, pointerEvents: 'none' }}>$</span>
            <input
              type="number"
              step="0.01"
              placeholder="100 or -50"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ paddingLeft: 24, width: '100%', fontSize: 13 }}
            />
          </div>
          <button type="submit" className="bf-save-btn" disabled={saving || !amount} style={{ '--bucket-color': config.color }}>
            {saving ? '…' : '+ Add'}
          </button>
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ fontSize: 12 }}
        />
      </form>
    </div>
  )
}

// ── Bonus Splitter ────────────────────────────────────────

function BonusSplitter({ settings }) {
  const [input, setInput] = useState('')
  const [split, setSplit] = useState(null)

  const bucketDefs = [
    { key: 'daily',   label: 'Daily Expenses', emoji: '🏠', color: '#4f7cff', pctKey: 'pct_daily' },
    { key: 'splurge', label: 'Splurge',         emoji: '🎉', color: '#f5a623', pctKey: 'pct_splurge' },
    { key: 'smile',   label: 'Smile',           emoji: '😊', color: '#2dd87a', pctKey: 'pct_smile' },
    { key: 'fire',    label: 'Fire Extinguisher',emoji: '🔥', color: '#ff5c5c', pctKey: 'pct_fire' },
  ]

  function calculate() {
    const amt = parseFloat(input)
    if (isNaN(amt) || amt <= 0) return
    setSplit(bucketDefs.map(b => ({
      ...b,
      pct: settings[b.pctKey] ?? 0,
      amount: Math.round(amt * ((settings[b.pctKey] ?? 0) / 100) * 100) / 100,
    })))
  }

  function handleKey(e) {
    if (e.key === 'Enter') calculate()
  }

  function reset() {
    setInput('')
    setSplit(null)
  }

  return (
    <div style={{
      marginBottom: 28,
      padding: '20px 24px',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>💸 Bonus Splitter</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Enter any amount to see how it splits across your buckets
          </div>
        </div>
        {split && (
          <button className="btn btn-ghost btn-sm" onClick={reset}>Reset</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: split ? 20 : 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', fontSize: 14, pointerEvents: 'none',
          }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={input}
            onChange={e => { setInput(e.target.value); setSplit(null) }}
            onKeyDown={handleKey}
            style={{ paddingLeft: 28, width: '100%' }}
            autoFocus
          />
        </div>
        <button className="btn btn-primary" onClick={calculate} disabled={!input || parseFloat(input) <= 0}>
          Calculate split
        </button>
      </div>

      {split && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {split.map(b => (
            <div key={b.key} style={{
              padding: '14px 16px',
              background: `color-mix(in srgb, ${b.color} 8%, var(--bg3))`,
              border: `1px solid color-mix(in srgb, ${b.color} 25%, var(--border))`,
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
                {b.emoji} {b.label}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: b.color }}>
                {fmt(b.amount)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {b.pct}% of {fmt(parseFloat(input))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────

function OverviewTab({ data, year, month, onDataChange }) {
  return (
    <div>
      {/* Income summary bar */}
      {data.monthly_income > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
              Normalised monthly income
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 24, color: 'var(--green)' }}>
              {fmt(data.monthly_income)}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>
            <div>Daily ({data.settings.pct_daily}%) {fmt(data.targets.daily)}</div>
            <div>Splurge ({data.settings.pct_splurge}%) {fmt(data.targets.splurge)}</div>
            <div>Smile ({data.settings.pct_smile}%) {fmt(data.targets.smile)}</div>
            <div>Fire ({data.settings.pct_fire}%) {fmt(data.targets.fire)}</div>
          </div>
        </div>
      )}

      {data.monthly_income === 0 && (
        <div className="card" style={{ marginBottom: 24, background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.3)' }}>
          <p style={{ color: 'var(--amber)', fontSize: 13 }}>
            👋 Welcome! Add your income streams in the <strong>Income</strong> tab to see your personalised bucket targets.
          </p>
        </div>
      )}

      {/* Bucket cards */}
      <div className="bf-bucket-grid">
        {Object.entries(BUCKETS).map(([key, config]) => (
          key === 'daily'
            ? <DailyBucketCard key={key} data={data} onSaved={onDataChange} />
            : key === 'splurge'
            ? <SplurgeBucketCard key={key} data={data} />
            : (key === 'smile' || key === 'fire')
            ? <TransactionBucketCard
                key={key}
                bucket={key}
                config={config}
                target={data.targets[key]}
                transactions={key === 'smile' ? data.smile_transactions_this_month : data.fire_transactions_this_month}
                runningTotal={data.running_totals[key] ?? 0}
                year={year}
                month={month}
                onSaved={onDataChange}
                pct={data.settings[`pct_${key}`]}
              />
            : <BucketCard
                key={key}
                bucket={key}
                config={config}
                target={data.targets[key]}
                deposited={data.this_month_deposits[key] ?? null}
                runningTotal={data.running_totals[key] ?? 0}
                year={year}
                month={month}
                onSaved={onDataChange}
                pct={data.settings[`pct_${key}`]}
              />
        ))}
      </div>

      {/* Bonus splitter */}
      <BonusSplitter settings={data.settings} />

      {/* Smile security */}
      <SmileSecurityCard data={data} onSettingsChange={onDataChange} />

      {/* Fire slush balance */}
      <div className="bf-fire-section">
        <div className="bf-fire-section-header">
          <div>
            <h3>🔥 Fire Extinguisher</h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {data.fire_mode === 'debts' ? 'Active debts to pay off' : 'No active debts — slush fund mode'}
            </div>
          </div>
        </div>
        <div className="bf-slush-balance">
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Available / unallocated</div>
            <div className="bf-slush-amount">{fmt(data.fire_slush_balance)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>
            <div>Total deposited: {fmt(data.running_totals.fire)}</div>
          </div>
        </div>
        {data.fire_goals.filter(g => !g.is_paid_off).slice(0, 3).map(g => (
          <div key={g.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>{g.is_slush_bill ? '💸 ' : ''}{g.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${g.progress_pct}%`, background: '#ff5c5c', borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text2)' }}>{g.progress_pct}%</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#ff5c5c' }}>{fmt(g.remaining)} left</span>
            </div>
          </div>
        ))}
        {data.fire_goals.filter(g => !g.is_paid_off).length === 0 && (
          <div className="empty-state" style={{ padding: 20 }}>
            <p style={{ fontSize: 13 }}>No active fire goals. Add debts or slush bills in the <strong>Fire Goals</strong> tab.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fire Goals Tab ────────────────────────────────────────

function FireGoalsTab({ data, onRefresh }) {
  const [celebration, setCelebration] = useState(null)
  const [addDebt, setAddDebt] = useState(false)
  const [addSlush, setAddSlush] = useState(false)
  const [linkableLiabilities, setLinkableLiabilities] = useState([])
  const [linkModal, setLinkModal] = useState(null) // prefill liability object

  useEffect(() => {
    getLinkableLiabilities().then(setLinkableLiabilities).catch(() => {})
  }, [data])

  const activeDebts = data.fire_goals.filter(g => !g.is_paid_off && !g.is_slush_bill)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  const slushBills = data.fire_goals.filter(g => !g.is_paid_off && g.is_slush_bill)
  const paidOff = data.fire_goals.filter(g => g.is_paid_off)

  return (
    <div>
      {celebration && (
        <Celebration goalName={celebration} onClose={() => setCelebration(null)} />
      )}

      {/* Slush balance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Available fire balance (unallocated)</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: 'var(--accent)' }}>{fmt(data.fire_slush_balance)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setAddSlush(true)}>+ Slush bill</button>
          <button className="btn btn-primary" onClick={() => setAddDebt(true)}>+ Add debt</button>
        </div>
      </div>

      {/* Unlinked Fire-tagged liabilities notice */}
      {linkableLiabilities.length > 0 && (
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: 'rgba(79,124,255,0.07)',
          border: '1px solid rgba(79,124,255,0.25)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
            📊 Asset Tracker liabilities tagged Fire
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {linkableLiabilities.map(lib => (
              <div key={lib.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span>
                  <strong style={{ color: 'var(--text)' }}>{lib.name}</strong>
                  {lib.latest_value != null && (
                    <span style={{ color: 'var(--text2)', marginLeft: 8, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                      ${Math.round(lib.latest_value).toLocaleString()}
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ borderColor: 'rgba(79,124,255,0.4)', color: 'var(--accent)' }}
                  onClick={() => setLinkModal(lib)}
                >
                  + Create linked goal
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active debts */}
      {activeDebts.length > 0 && (
        <div className="bf-fire-section" style={{ marginBottom: 24 }}>
          <div className="bf-fire-section-header">
            <h3>Active Debts</h3>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sorted by priority</span>
          </div>
          {activeDebts.map(g => (
            <FireGoalCard key={g.id} goal={g} onRefresh={onRefresh} onCelebrate={name => setCelebration(name)} />
          ))}
        </div>
      )}

      {/* Slush bills */}
      {slushBills.length > 0 && (
        <div className="bf-fire-section" style={{ marginBottom: 24 }}>
          <div className="bf-fire-section-header">
            <h3>Slush Bills</h3>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Upcoming costs to fund from slush</span>
          </div>
          {slushBills.map(g => (
            <FireGoalCard key={g.id} goal={g} onRefresh={onRefresh} onCelebrate={name => setCelebration(name)} />
          ))}
        </div>
      )}

      {activeDebts.length === 0 && slushBills.length === 0 && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 22, marginBottom: 8 }}>Debt free!</div>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>No active debts. Your fire fund is in slush mode — add upcoming bills when they arrive.</p>
        </div>
      )}

      {/* Paid off history */}
      {paidOff.length > 0 && (
        <div className="bf-fire-section">
          <div className="bf-fire-section-header">
            <h3>Paid Off 🏆</h3>
            <span style={{ fontSize: 12, color: 'var(--green)' }}>{paidOff.length} goal{paidOff.length !== 1 ? 's' : ''} crushed</span>
          </div>
          {paidOff.map(g => (
            <FireGoalCard key={g.id} goal={g} onRefresh={onRefresh} onCelebrate={name => setCelebration(name)} />
          ))}
        </div>
      )}

      {addDebt && <FireGoalModal isSlushBill={false} onClose={() => setAddDebt(false)} onSave={() => { setAddDebt(false); onRefresh() }} />}
      {addSlush && <FireGoalModal isSlushBill={true} onClose={() => setAddSlush(false)} onSave={() => { setAddSlush(false); onRefresh() }} />}
      {linkModal && (
        <FireGoalModal
          isSlushBill={false}
          prefillLiability={linkModal}
          onClose={() => setLinkModal(null)}
          onSave={() => { setLinkModal(null); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── Income Tab ────────────────────────────────────────────

function IncomeModal({ stream, onClose, onSave }) {
  const [name, setName] = useState(stream?.name || '')
  const [amount, setAmount] = useState(stream?.amount != null ? String(stream.amount) : '')
  const [frequency, setFrequency] = useState(stream?.frequency || 'monthly')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!name.trim()) { setError('Name is required'); return }
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), amount: amt, frequency }
      if (stream) { await updateBarefootIncome(stream.id, payload) }
      else { await createBarefootIncome(payload) }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>{stream ? 'Edit Income Stream' : 'Add Income Stream'}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jon Salary" autoFocus />
        </div>
        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Amount ($)</label>
            <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="field">
            <label>Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : stream ? 'Save changes' : 'Add stream'}</button>
        </div>
      </form>
    </Modal>
  )
}

function BucketRatioEditor({ settings, onSaved }) {
  const [daily, setDaily] = useState(String(settings.pct_daily ?? 60))
  const [splurge, setSplurge] = useState(String(settings.pct_splurge ?? 10))
  const [smile, setSmile] = useState(String(settings.pct_smile ?? 10))
  const [fire, setFire] = useState(String(settings.pct_fire ?? 20))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const total = (parseFloat(daily) || 0) + (parseFloat(splurge) || 0) + (parseFloat(smile) || 0) + (parseFloat(fire) || 0)
  const totalOk = Math.abs(total - 100) < 0.01

  async function handleSave() {
    if (!totalOk) { setError('Ratios must add up to 100%'); return }
    setSaving(true)
    setError(null)
    try {
      await updateBarefootSettings({
        pct_daily: parseFloat(daily),
        pct_splurge: parseFloat(splurge),
        pct_smile: parseFloat(smile),
        pct_fire: parseFloat(fire),
      })
      setSaved(true)
      onSaved()
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const buckets = [
    { key: 'daily',   label: 'Daily Expenses', emoji: '🏠', color: '#4f7cff', val: daily,   set: setDaily },
    { key: 'splurge', label: 'Splurge',         emoji: '🎉', color: '#f5a623', val: splurge, set: setSplurge },
    { key: 'smile',   label: 'Smile',           emoji: '😊', color: '#2dd87a', val: smile,   set: setSmile },
    { key: 'fire',    label: 'Fire Extinguisher',emoji: '🔥', color: '#ff5c5c', val: fire,    set: setFire },
  ]

  return (
    <div style={{ marginBottom: 32, padding: '20px 24px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Bucket Ratios</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>How your income is split across each bucket</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: totalOk ? '#2dd87a' : '#ff5c5c', fontWeight: 600 }}>
            {total.toFixed(1)}% total
          </span>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !totalOk}>
            {saved ? '✓ Saved' : saving ? '…' : 'Save ratios'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {buckets.map(b => (
          <div key={b.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{b.emoji}</span> {b.label}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={b.val}
                onChange={e => b.set(e.target.value)}
                style={{ paddingRight: 24, borderColor: `color-mix(in srgb, ${b.color} 40%, var(--border))` }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)', pointerEvents: 'none' }}>%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: `color-mix(in srgb, ${b.color} ${parseFloat(b.val) || 0}%, var(--border))` }} />
          </div>
        ))}
      </div>

      {!totalOk && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#ff5c5c' }}>
          Ratios must add up to 100% (currently {total.toFixed(1)}%)
        </div>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: '#ff5c5c' }}>{error}</div>}
    </div>
  )
}

function IncomeTab({ data, onDataChange }) {
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editStream, setEditStream] = useState(null)

  const FREQ_LABELS = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' }
  const FREQ_NOTE = { weekly: '× 52 ÷ 12', fortnightly: '× 26 ÷ 12', monthly: '× 1' }

  const load = useCallback(async () => {
    setLoading(true)
    try { setStreams(await getBarefootIncome()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Remove this income stream?')) return
    await deleteBarefootIncome(id)
    load()
  }

  const totalMonthly = streams.filter(s => s.is_active).reduce((sum, s) => sum + s.monthly_equivalent, 0)

  return (
    <div>
      {data?.settings && (
        <BucketRatioEditor settings={data.settings} onSaved={onDataChange} />
      )}

      <div className="bf-income-total-bar">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Total normalised monthly income
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: 'var(--green)' }}>{fmt(totalMonthly)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add stream</button>
      </div>

      {loading ? <p className="text-muted">Loading…</p> : streams.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <p>No income streams yet.</p>
          <p style={{ marginTop: 8 }}>Add your salary, rental income, side hustle — anything that comes in regularly.</p>
        </div>
      ) : (
        <div className="bf-income-grid">
          {streams.map(s => (
            <div key={s.id} className="bf-income-card" style={{ opacity: s.is_active ? 1 : 0.5 }}>
              <div className="bf-income-info">
                <div className="bf-income-name">{s.name}</div>
                <div className="bf-income-sub">
                  {fmt(s.amount)} / {s.frequency.toLowerCase()}
                  <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{FREQ_NOTE[s.frequency]}</span>
                  {!s.is_active && <span style={{ color: 'var(--text3)', marginLeft: 8 }}>(inactive)</span>}
                </div>
              </div>
              <span className="bf-freq-badge">{FREQ_LABELS[s.frequency]}</span>
              <div className="bf-income-monthly">{fmt(s.monthly_equivalent)}<span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>/mo</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditStream(s)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addModal && <IncomeModal onClose={() => setAddModal(false)} onSave={() => { setAddModal(false); load() }} />}
      {editStream && <IncomeModal stream={editStream} onClose={() => setEditStream(null)} onSave={() => { setEditStream(null); load() }} />}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function Barefoot() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await getBarefootDashboard(year, month)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  if (error) return <div className="page"><p className="text-red">{error}</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>👣 Barefoot Tracker</h1>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            {data
              ? `Daily ${data.settings.pct_daily}% · Splurge ${data.settings.pct_splurge}% · Smile ${data.settings.pct_smile}% · Fire ${data.settings.pct_fire}%`
              : 'Daily 60% · Splurge 10% · Smile 10% · Fire 20%'}
          </div>
        </div>
        <div className="month-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="month-label">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 28 }}>
        <button className={`tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab${tab === 'fire' ? ' active' : ''}`} onClick={() => setTab('fire')}>🔥 Fire Goals</button>
        <button className={`tab${tab === 'income' ? ' active' : ''}`} onClick={() => setTab('income')}>Income</button>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab data={data} year={year} month={month} onDataChange={load} />}
          {tab === 'fire' && <FireGoalsTab data={data} onRefresh={load} />}
          {tab === 'income' && <IncomeTab data={data} onDataChange={load} />}
        </>
      )}
    </div>
  )
}
