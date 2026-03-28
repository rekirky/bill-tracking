import { useState, useEffect, useCallback } from 'react'
import { getBillsByMonth, createBill, updateBill, deleteBill } from '../api.js'
import { fmt, fmtDate, progressClass, MONTHS, FREQ_LABELS } from '../utils.js'
import BillForm from '../components/BillForm.jsx'
import MoneyAsideForm from '../components/MoneyAsideForm.jsx'
import PaymentForm from '../components/PaymentForm.jsx'

export default function BillsByMonth() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'paid' | 'unpaid'

  const load = useCallback(() => {
    setLoading(true)
    getBillsByMonth(year, month)
      .then(setData)
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function openEdit(bill) { setSelected(bill); setModal('edit') }
  function openAside(bill) { setSelected(bill); setModal('aside') }
  function openPay(bill) { setSelected(bill); setModal('pay') }
  function closeModal() { setModal(null); setSelected(null) }

  async function handleSaveBill(payload) {
    if (modal === 'edit') await updateBill(selected.id, payload)
    else await createBill(payload)
    closeModal(); load()
  }

  async function handleDelete(bill) {
    if (!confirm(`Delete "${bill.name}"?`)) return
    await deleteBill(bill.id)
    load()
  }

  const allBills = data?.bills ?? []
  const bills = filter === 'paid'
    ? allBills.filter(b => b.is_paid)
    : filter === 'unpaid'
      ? allBills.filter(b => !b.is_paid)
      : allBills
  const unpaidBills = allBills.filter(b => !b.is_paid)
  const unpaidAmount = unpaidBills.reduce((s, b) => s + b.estimated_amount, 0)
  const unpaidAside = unpaidBills.reduce((s, b) => s + b.total_aside, 0)
  const unpaidOutstanding = unpaidBills.reduce((s, b) => s + b.outstanding, 0)
  const totalPct = unpaidAmount > 0
    ? Math.min((unpaidAside / unpaidAmount) * 100, 100) : 0

  return (
    <div className="page">
      <div className="page-header">
        <div className="month-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="month-label">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
        <div className="flex gap-8">
          <div className="btn-group">
            <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>All</button>
            <button className={`btn btn-sm ${filter === 'unpaid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('unpaid')}>Unpaid</button>
            <button className={`btn btn-sm ${filter === 'paid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('paid')}>Paid</button>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Bill</button>
        </div>
      </div>

      {/* Month summary strip */}
      {data && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">{filter === 'paid' ? 'Paid bills' : filter === 'unpaid' ? 'Unpaid bills' : 'Bills this month'}</div>
            <div className="stat-value">{bills.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total amount</div>
            <div className="stat-value">{fmt(unpaidAmount)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Put aside</div>
            <div className="stat-value green">{fmt(unpaidAside)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Outstanding</div>
            <div className={`stat-value ${unpaidOutstanding > 0 ? 'amber' : 'green'}`}>
              {fmt(unpaidOutstanding)}
            </div>
          </div>
        </div>
      )}

      {/* Month progress bar */}
      {data && data.total_amount > 0 && (
        <div className="card card-sm" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text2)' }}>
            <span>Month coverage</span>
            <span className="mono">{Math.round(totalPct)}% funded</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className={`progress-fill ${progressClass(totalPct)}`} style={{ width: `${totalPct}%` }} />
          </div>
        </div>
      )}

      {/* Bills table */}
      <div className="card" style={{ padding: 0 }}>
        {loading
          ? <div className="empty-state"><p>Loading…</p></div>
          : bills.length === 0
            ? <div className="empty-state"><p>No {filter !== 'all' ? filter : ''} bills for {MONTHS[month - 1]} {year}.</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Due</th>
                      <th>Frequency</th>
                      <th>Amount</th>
                      <th>Aside</th>
                      <th>Outstanding</th>
                      <th>Progress</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => {
                      const pct = bill.estimated_amount > 0
                        ? Math.min((bill.total_aside / bill.estimated_amount) * 100, 100) : 0
                      const cls = progressClass(pct)
                      return (
                        <tr key={bill.id}>
                          <td>
                            <strong>{bill.name}</strong>
                            <br />
                            <span className="text-muted" style={{ fontSize: 11 }}>{bill.payment_type}</span>
                          </td>
                          <td className="muted">{fmtDate(bill.due_date)}</td>
                          <td><span className="badge badge-muted">{FREQ_LABELS[bill.frequency]}</span></td>
                          <td className="mono">{fmt(bill.estimated_amount)}</td>
                          <td className="mono text-green">{fmt(bill.total_aside)}</td>
                          <td className={`mono ${bill.is_paid ? 'text-muted' : bill.outstanding > 0 ? 'text-amber' : 'text-green'}`}>
                            {bill.is_paid ? '—' : bill.outstanding > 0 ? fmt(bill.outstanding) : '✓ Covered'}
                          </td>
                          <td style={{ minWidth: 120 }}>
                            {bill.is_paid
                              ? <span className="badge badge-paid">Paid</span>
                              : (
                                <div className="progress-wrap">
                                  <div className="progress-bar">
                                    <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', minWidth: 34 }}>
                                    {Math.round(pct)}%
                                  </span>
                                </div>
                              )
                            }
                          </td>
                          <td>
                            <div className="flex gap-8">
                              <button className="btn btn-ghost btn-sm" onClick={() => openAside(bill)} title="Log money aside">＋</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openPay(bill)} title="Record payment">✓</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(bill)} title="Edit">✎</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(bill)} title="Delete">✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <BillForm initial={modal === 'edit' ? selected : null} onSave={handleSaveBill} onClose={closeModal} />
      )}
      {modal === 'aside' && selected && (
        <MoneyAsideForm bill={selected} onDone={() => { closeModal(); load() }} onClose={closeModal} />
      )}
      {modal === 'pay' && selected && (
        <PaymentForm bill={selected} onDone={() => { closeModal(); load() }} onClose={closeModal} />
      )}
    </div>
  )
}
