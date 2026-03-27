import { useState, useEffect } from 'react'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../api.js'
import { fmt } from '../utils.js'
import Modal from '../components/Modal.jsx'

const EMPTY = { name: '', is_primary_bills_account: false, current_balance: '' }

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => getAccounts().then(setAccounts)
  useEffect(() => { load() }, [])

  function openAdd() { setForm(EMPTY); setSelected(null); setModal('form') }
  function openEdit(a) { setForm({ name: a.name, is_primary_bills_account: a.is_primary_bills_account, current_balance: String(a.current_balance) }); setSelected(a); setModal('form') }
  function closeModal() { setModal(null); setSelected(null); setError('') }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function submit() {
    if (!form.name) { setError('Name is required.'); return }
    setSaving(true)
    try {
      const payload = { ...form, current_balance: parseFloat(form.current_balance || 0) }
      if (selected) await updateAccount(selected.id, payload)
      else await createAccount(payload)
      closeModal(); load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(a) {
    if (!confirm(`Delete account "${a.name}"?`)) return
    await deleteAccount(a.id)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p className="text-muted mt-8">Manage your bank accounts (BWB, BWG, ANZ…)</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Account</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {accounts.length === 0
          ? (
            <div className="empty-state">
              <p>No accounts yet. Add your first account to get started.</p>
            </div>
          )
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.name}</strong></td>
                      <td>
                        {a.is_primary_bills_account
                          ? <span className="badge badge-green">Primary bills</span>
                          : <span className="badge badge-muted">Secondary</span>}
                      </td>
                      <td className="mono">{fmt(a.current_balance)}</td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {modal === 'form' && (
        <Modal
          title={selected ? 'Edit Account' : 'Add Account'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field">
              <label>Account name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. BWB" autoFocus />
            </div>
            <div className="field">
              <label>Current balance</label>
              <input type="number" step="0.01" value={form.current_balance} onChange={set('current_balance')} placeholder="0.00" />
            </div>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="primary" checked={form.is_primary_bills_account} onChange={set('is_primary_bills_account')} style={{ width: 'auto' }} />
              <label htmlFor="primary" style={{ margin: 0, cursor: 'pointer' }}>Primary bills account</label>
            </div>
            {error && <p className="error-msg">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
