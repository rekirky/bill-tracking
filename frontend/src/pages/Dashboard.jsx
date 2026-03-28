import { useState, useEffect, useCallback } from 'react'
import { getDashboard, createBill, updateBill, deleteBill } from '../api.js'
import { fmtDate, fmt, progressClass, FREQ_LABELS } from '../utils.js'
import BillForm from '../components/BillForm.jsx'
import MoneyAsideForm from '../components/MoneyAsideForm.jsx'
import PaymentForm from '../components/PaymentForm.jsx'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'aside' | 'pay'
  const [selected, setSelected] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getDashboard()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

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
    if (!confirm(`Delete "${bill.name}"? This cannot be undone.`)) return
    await deleteBill(bill.id)
    load()
  }

  if (loading && !data) return <div className="page"><p className="text-muted">Loading…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted mt-8">Overview of all active bills</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Bill</button>
      </div>

      {/* Upcoming bills table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <h3>Upcoming bills</h3>
        </div>
        <div className="table-wrap">
          {data?.upcoming_bills?.length === 0
            ? <div className="empty-state"><p>No upcoming bills. Add one to get started.</p></div>
            : (
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
                  {data?.upcoming_bills?.map((bill) => {
                    const pct = bill.estimated_amount > 0
                      ? Math.min((bill.total_aside / bill.estimated_amount) * 100, 100) : 0
                    const cls = progressClass(pct)
                    return (
                      <tr key={bill.id}>
                        <td><strong>{bill.name}</strong><br /><span className="text-muted" style={{fontSize:11}}>{bill.payment_type}</span></td>
                        <td className="muted">{fmtDate(bill.due_date)}</td>
                        <td className="muted">{FREQ_LABELS[bill.frequency]}</td>
                        <td className="mono">{fmt(bill.estimated_amount)}</td>
                        <td className="mono text-green">{fmt(bill.total_aside)}</td>
                        <td className={`mono text-${cls}`}>{fmt(bill.outstanding)}</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="progress-wrap">
                            <div className="progress-bar">
                              <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', minWidth: 34 }}>
                              {Math.round(pct)}%
                            </span>
                          </div>
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
            )
          }
        </div>
      </div>

      {/* Modals */}
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
