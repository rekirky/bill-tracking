import { useState, useEffect } from 'react'
import { getAccounts, getImportFormats, previewImport, commitImport } from '../api.js'
import { fmt, fmtDate } from '../utils.js'

export default function Import() {
  const [accounts, setAccounts] = useState([])
  const [formats, setFormats] = useState([])
  const [accountId, setAccountId] = useState('')
  const [format, setFormat] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [checked, setChecked] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    getAccounts().then(setAccounts)
    getImportFormats().then(setFormats)
  }, [])

  async function handlePreview() {
    if (!accountId || !format || !file) { setError('Pick account, format, and file.'); return }
    setError(''); setLoading(true); setResult(null); setPreview(null)
    try {
      const res = await previewImport(accountId, format, file)
      setPreview(res)
      const init = {}
      res.rows.forEach(r => { init[r.row_index] = !r.is_duplicate })
      setChecked(init)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleRow(idx) {
    setChecked(c => ({ ...c, [idx]: !c[idx] }))
  }

  function toggleAll(value) {
    const next = {}
    preview.rows.forEach(r => { next[r.row_index] = value })
    setChecked(next)
  }

  async function handleCommit() {
    const rows = preview.rows
      .filter(r => checked[r.row_index])
      .map(r => ({ date: r.date, description: r.description, amount: r.amount, balance: r.balance }))
    if (rows.length === 0) { setError('No rows selected.'); return }
    setLoading(true); setError('')
    try {
      const res = await commitImport({ account_id: parseInt(accountId), format, rows })
      setResult(res)
      setPreview(null)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = preview ? Object.values(checked).filter(Boolean).length : 0

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Import Transactions</h1>
          <p className="text-muted mt-8">Upload a bank export CSV and bring transactions in.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid form-grid-3">
          <div className="field">
            <label>Account *</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Bank format *</label>
            <select value={format} onChange={e => setFormat(e.target.value)}>
              <option value="">Select format…</option>
              {formats.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>CSV file *</label>
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
          </div>
        </div>
        {error && <p className="error-msg mt-8">{error}</p>}
        <div className="mt-16">
          <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
            {loading ? 'Reading…' : 'Preview'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card mt-16">
          <p>
            Imported <strong>{result.imported}</strong> transaction{result.imported === 1 ? '' : 's'}.
            {result.skipped_duplicates > 0 && ` Skipped ${result.skipped_duplicates} duplicate${result.skipped_duplicates === 1 ? '' : 's'}.`}
          </p>
        </div>
      )}

      {preview && (
        <div className="card mt-16" style={{ padding: 0 }}>
          <div className="page-header" style={{ padding: 16 }}>
            <div>
              <strong>{preview.rows.length}</strong> rows — {preview.new_count} new, {preview.duplicate_count} duplicate
              <span className="text-muted"> ({selectedCount} selected)</span>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(true)}>Select all</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleAll(false)}>Select none</button>
              <button className="btn btn-primary btn-sm" onClick={handleCommit} disabled={loading || selectedCount === 0}>
                {loading ? 'Importing…' : `Import ${selectedCount}`}
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(r => (
                  <tr key={r.row_index} style={r.is_duplicate ? { opacity: 0.5 } : undefined}>
                    <td><input type="checkbox" checked={!!checked[r.row_index]} onChange={() => toggleRow(r.row_index)} /></td>
                    <td>{fmtDate(r.date)}</td>
                    <td>
                      {r.description}
                      {r.is_duplicate && <span className="badge badge-muted" style={{ marginLeft: 8 }}>Duplicate</span>}
                    </td>
                    <td className="mono">{fmt(r.amount)}</td>
                    <td className="mono">{r.balance != null ? fmt(r.balance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
