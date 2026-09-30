import { useState } from 'react'
import Modal from './Modal.jsx'
import { recordPayment } from '../api.js'
import { fmt, FREQ_LABELS } from '../utils.js'

export default function PaymentForm({ bill, onDone, onClose }) {
  const remaining = Math.max(bill.estimated_amount - (bill.amount_paid || 0), 0)
  const [form, setForm] = useState({
    amount_paid: String(bill.amount_paid > 0 ? remaining : bill.estimated_amount),
    date_paid: new Date().toISOString().slice(0, 10),
    is_part_payment: false,
    notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({
    ...f,
    [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }))

  async function submit() {
    if (!form.amount_paid || !form.date_paid) { setError('Amount and date are required.'); return }
    setSaving(true)
    try {
      await recordPayment({
        bill_id: bill.id,
        amount_paid: parseFloat(form.amount_paid),
        date_paid: form.date_paid,
        is_part_payment: form.is_part_payment,
        notes: form.notes || null,
      })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Record payment — ${bill.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </>
      }
    >
      <p className="text-muted" style={{ marginBottom: 20, fontSize: 13 }}>
        Estimated: <span className="mono">{fmt(bill.estimated_amount)}</span> ·
        Frequency: <span>{FREQ_LABELS[bill.frequency]}</span>
        {bill.frequency !== 'once' && <> · Next due date will be auto-calculated</>}
        {bill.amount_paid > 0 && (
          <><br />Already paid <span className="mono">{fmt(bill.amount_paid)}</span> — <span className="mono">{fmt(remaining)}</span> remaining</>
        )}
      </p>
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Amount paid *</label>
            <input type="number" step="0.01" value={form.amount_paid} onChange={set('amount_paid')} autoFocus />
          </div>
          <div className="field">
            <label>Date paid *</label>
            <input type="date" value={form.date_paid} onChange={set('date_paid')} />
          </div>
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="part-payment"
            checked={form.is_part_payment}
            onChange={set('is_part_payment')}
            style={{ width: 'auto' }}
          />
          <label htmlFor="part-payment" style={{ margin: 0, cursor: 'pointer' }}>
            Part payment — bill stays open, next cycle still bills the full {fmt(bill.estimated_amount)}
          </label>
        </div>
        <div className="field">
          <label>Notes</label>
          <input value={form.notes} onChange={set('notes')} placeholder="Optional" />
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </Modal>
  )
}
