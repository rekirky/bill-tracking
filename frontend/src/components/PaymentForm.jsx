import { useState } from 'react'
import Modal from './Modal.jsx'
import { recordPayment } from '../api.js'
import { fmt, FREQ_LABELS } from '../utils.js'

export default function PaymentForm({ bill, onDone, onClose }) {
  const [form, setForm] = useState({
    amount_paid: String(bill.estimated_amount),
    date_paid: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit() {
    if (!form.amount_paid || !form.date_paid) { setError('Amount and date are required.'); return }
    setSaving(true)
    try {
      await recordPayment({
        bill_id: bill.id,
        amount_paid: parseFloat(form.amount_paid),
        date_paid: form.date_paid,
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
        <div className="field">
          <label>Notes</label>
          <input value={form.notes} onChange={set('notes')} placeholder="Optional" />
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </Modal>
  )
}
