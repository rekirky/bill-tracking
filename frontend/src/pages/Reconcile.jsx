import { useState, useEffect, useCallback } from 'react'
import { getAccounts, getReconciliations, getLiveTotal, createReconciliation } from '../api.js'
import { fmt } from '../utils.js'
import Modal from '../components/Modal.jsx'

export default function Reconcile() {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [history, setHistory] = useState([])
  const [liveTotal, setLiveTotal] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ bank_balance: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAccounts().then((accs) => {
      setAccounts(accs)
      const primary = accs.find((a) => a.is_primary_bills_account)
      if (primary) setAccountId(String(primary.id))
    })
  }, [])

  const refreshLive = useCallback(() => {
    if (!accountId) return
    getLiveTotal(accountId).then((r) => setLiveTotal(r.system_total))
  }, [accountId])

  useEffect(() => {
    if (!accountId) return
    getReconciliations(accountId).then(setHistory)
    refreshLive()
  }, [accountId, refreshLive])

  // Refresh live total whenever the user returns to this tab
  useEffect(() => {
    window.addEventListener('focus', refreshLive)
    return () => window.removeEventListener('focus', refreshLive)
  }, [refreshLive])

  async function submit() {
    if (!form.bank_balance) { setError('Bank balance is required.'); return }
    setSaving(true)
    try {
      await createReconciliation({
        account_id: parseInt(accountId),
        bank_balance: parseFloat(form.bank_balance),
        notes: form.notes || null,
      })
      setShowModal(false)
      setForm({ bank_balance: '', notes: '' })
      getReconciliations(accountId).then(setHistory)
      refreshLive()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const latest = history[0]
  const liveSystemTotal = liveTotal ?? latest?.system_total ?? 0
  const liveDifference = latest ? latest.bank_balance - liveSystemTotal : 0

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reconcile</h1>
          <p className="text-muted mt-8">Check your bank account against money put aside</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Check balance</button>
      </div>

      {/* Account selector */}
      <div className="card card-sm" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Checking account:</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ maxWidth: 260 }}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_primary_bills_account ? ' (primary)' : ''}</option>)}
        </select>
      </div>

      {/* Latest result */}
      {latest && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Latest check — {new Date(latest.checked_at).toLocaleString('en-AU')}</h3>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card">
              <div className="stat-label">Bank balance</div>
              <div className="stat-value">{fmt(latest.bank_balance)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">System total (aside)</div>
              <div className="stat-value">{fmt(liveSystemTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Difference</div>
              <div className={`stat-value ${Math.abs(liveDifference) < 0.01 ? 'green' : liveDifference > 0 ? 'amber' : 'red'}`}>
                {fmt(liveDifference)}
              </div>
            </div>
          </div>
          {Math.abs(liveDifference) < 0.01 && (
            <p className="text-green mt-16" style={{ fontSize: 13 }}>✓ Balanced — your bank account matches your records.</p>
          )}
          {liveDifference > 0.01 && (
            <p className="text-amber mt-16" style={{ fontSize: 13 }}>↑ Your bank has more than recorded — you may have untracked deposits.</p>
          )}
          {liveDifference < -0.01 && (
            <p className="text-red mt-16" style={{ fontSize: 13 }}>↓ Your bank has less than recorded — check for missing money aside entries.</p>
          )}
          {latest.notes && <p className="text-muted mt-8" style={{ fontSize: 12 }}>Note: {latest.notes}</p>}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3>History</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank balance</th>
                  <th>System total</th>
                  <th>Difference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(1).map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{new Date(r.checked_at).toLocaleString('en-AU')}</td>
                    <td className="mono">{fmt(r.bank_balance)}</td>
                    <td className="mono">{fmt(r.system_total)}</td>
                    <td className={`mono ${Math.abs(r.difference) < 0.01 ? 'text-green' : r.difference > 0 ? 'text-amber' : 'text-red'}`}>
                      {fmt(r.difference)}
                    </td>
                    <td className="muted">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length === 0 && !latest && (
        <div className="empty-state">
          <p>No reconciliations yet. Click "Check balance" to start.</p>
        </div>
      )}

      {showModal && (
        <Modal
          title="Check bank balance"
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Record check'}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ marginBottom: 20, fontSize: 13 }}>
            Enter the current balance of your bills savings account as shown in your banking app.
            The system will compare it against your recorded money aside total.
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Bank account balance *</label>
              <input
                type="number" step="0.01" autoFocus
                value={form.bank_balance}
                onChange={(e) => setForm((f) => ({ ...f, bank_balance: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
