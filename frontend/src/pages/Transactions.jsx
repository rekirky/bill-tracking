import { useState, useEffect, useCallback } from 'react'
import {
  getAccounts, getTransactions, getTransactionTags,
  setTransactionTags, bulkTagTransactions, bulkDeleteTransactions, deleteTransaction,
} from '../api.js'
import { fmt, fmtDate } from '../utils.js'
import TagPicker from '../components/TagPicker.jsx'

export default function Transactions() {
  const [accounts, setAccounts] = useState([])
  const [allTags, setAllTags] = useState([])
  const [txns, setTxns] = useState([])
  const [accountId, setAccountId] = useState('')
  const [tagId, setTagId] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [bulkTags, setBulkTags] = useState([])
  const [loading, setLoading] = useState(false)

  const loadTags = () => getTransactionTags().then(setAllTags)

  const loadTxns = useCallback(() => {
    setLoading(true)
    const params = {}
    if (accountId) params.account_id = accountId
    if (tagId) params.tag_id = tagId
    return getTransactions(params).then(setTxns).finally(() => setLoading(false))
  }, [accountId, tagId])

  useEffect(() => { getAccounts().then(setAccounts); loadTags() }, [])
  useEffect(() => { loadTxns() }, [loadTxns])

  const visible = txns.filter(t =>
    !search || t.description.toLowerCase().includes(search.toLowerCase())
  )

  function toggleSelect(id) {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(s => s.size === visible.length ? new Set() : new Set(visible.map(t => t.id)))
  }

  async function saveRowTags(txn, newTags) {
    const tag_ids = newTags.filter(t => t.id != null).map(t => t.id)
    const tag_names = newTags.filter(t => t.id == null).map(t => t.name)
    const updated = await setTransactionTags(txn.id, { tag_ids, tag_names })
    setTxns(list => list.map(t => t.id === txn.id ? updated : t))
    if (tag_names.length) loadTags()
  }

  async function applyBulkTags() {
    if (bulkTags.length === 0 || selected.size === 0) return
    const tag_ids = bulkTags.filter(t => t.id != null).map(t => t.id)
    const tag_names = bulkTags.filter(t => t.id == null).map(t => t.name)
    await bulkTagTransactions({ transaction_ids: [...selected], tag_ids, tag_names })
    setBulkTags([])
    setSelected(new Set())
    loadTags()
    loadTxns()
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} transaction${selected.size === 1 ? '' : 's'}? This can't be undone.`)) return
    await bulkDeleteTransactions({ transaction_ids: [...selected] })
    setSelected(new Set())
    loadTxns()
  }

  async function handleDelete(txn) {
    if (!confirm(`Delete this transaction? "${txn.description}"`)) return
    await deleteTransaction(txn.id)
    loadTxns()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="text-muted mt-8">Tag transactions to power visualisations and rules.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid form-grid-3">
          <div className="field">
            <label>Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tag</label>
            <select value={tagId} onChange={e => setTagId(e.target.value)}>
              <option value="">All tags</option>
              {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Search description</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. KFC" />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card mt-16 flex gap-8" style={{ alignItems: 'center' }}>
          <strong>{selected.size} selected</strong>
          <div style={{ minWidth: 240 }}>
            <TagPicker tags={bulkTags} allTags={allTags} onChange={setBulkTags} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={applyBulkTags} disabled={bulkTags.length === 0}>
            Apply tags
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete selected</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="card mt-16" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet. Import a bank statement to get started.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size > 0 && selected.size === visible.length} onChange={toggleSelectAll} /></th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Tags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => (
                  <tr key={t.id}>
                    <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.description}</td>
                    <td className="mono" style={{ color: t.amount < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(t.amount)}</td>
                    <td style={{ minWidth: 200 }}>
                      <TagPicker tags={t.tags} allTags={allTags} onChange={(next) => saveRowTags(t, next)} />
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
