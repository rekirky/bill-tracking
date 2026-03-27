import { useState, useEffect } from 'react'
import Modal from './Modal.jsx'
import { getAccounts, addMoneyAside } from '../api.js'
import { fmt } from '../utils.js'

export default function MoneyAsideForm({ bill, onDone, onClose }) {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ amount: '', account_id: '', date_recorded: new Date().toISOString().slice(0, 10), notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAccounts().then((accs) => {
      setAccounts(accs)
      const primary = accs.find((a) => a.is_primary_bills_account)
      if (primary) setForm((f) => ({ ...f, account_id: String(primary.id) }))
    })
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit() {
    if (!form.amount || !form.account_id) { setError('Amount and account are required.'); return }
    setSaving(true)
    try {
      await addMoneyAside({
        bill_id: bill.id,
        account_id: parseInt(form.account_id),
        amount: parseFloat(form.amount),
        date_recorded: form.date_recorded,
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
      title={`Money aside — ${bill.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Record'}
          </button>
        </>
      }
    >
      <p className="text-muted" style={{ marginBottom: 20, fontSize: 13 }}>
        Bill amount: <span className="mono">{fmt(bill.estimated_amount)}</span> ·
        Already aside: <span className="mono">{fmt(bill.total_aside)}</span> ·
        Still needed: <span className="mono text-amber">{fmt(bill.outstanding)}</span>
      </p>
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Amount *</label>
            <input type="number" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" autoFocus />
          </div>
          <div className="field">
            <label>Date *</label>
            <input type="date" value={form.date_recorded} onChange={set('date_recorded')} />
          </div>
        </div>
        <div className="field">
          <label>Account *</label>
          <select value={form.account_id} onChange={set('account_id')}>
            <option value="">Select…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
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
