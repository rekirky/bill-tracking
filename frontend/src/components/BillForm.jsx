import { useState, useEffect } from 'react'
import Modal from './Modal.jsx'
import { FREQ_LABELS } from '../utils.js'
import { getAccounts } from '../api.js'

const EMPTY = {
  name: '', estimated_amount: '', due_date: '', payment_type: '',
  account_id: '', frequency: 'monthly',
}

export default function BillForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...initial, estimated_amount: String(initial.estimated_amount) } : EMPTY)
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.estimated_amount || !form.due_date || !form.account_id) {
      setError('Please fill in all required fields.')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...form,
        estimated_amount: parseFloat(form.estimated_amount),
        account_id: parseInt(form.account_id),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit Bill' : 'Add Bill'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="field">
          <label>Bill name *</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Electricity" />
        </div>

        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Estimated amount *</label>
            <input type="number" step="0.01" value={form.estimated_amount} onChange={set('estimated_amount')} placeholder="0.00" />
          </div>
          <div className="field">
            <label>Due date *</label>
            <input type="date" value={form.due_date} onChange={set('due_date')} />
          </div>
        </div>

        <div className="form-grid form-grid-2">
          <div className="field">
            <label>Frequency *</label>
            <select value={form.frequency} onChange={set('frequency')}>
              {Object.entries(FREQ_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment type</label>
            <input value={form.payment_type} onChange={set('payment_type')} placeholder="e.g. Automatic-BWB" />
          </div>
        </div>

        <div className="field">
          <label>Account *</label>
          <select value={form.account_id} onChange={set('account_id')}>
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="error-msg">{error}</p>}
      </form>
    </Modal>
  )
}
