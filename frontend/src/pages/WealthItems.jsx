import { useEffect, useState, useCallback } from 'react'
import Modal from '../components/Modal.jsx'
import {
  getWealthItems, createWealthItem, updateWealthItem, deleteWealthItem,
  getWealthTags, createWealthTag, updateWealthTag, deleteWealthTag,
  getSnapshotsByMonth, bulkUpsertSnapshots,
} from '../api.js'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TAG_COLORS = [
  '#4f7cff', '#2dd87a', '#ff5c5c', '#f5a623',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899',
  '#10b981', '#6366f1', '#fbbf24', '#14b8a6',
]

function fmt(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function TagPill({ tag }) {
  return (
    <span
      className="wealth-tag-pill"
      style={{
        backgroundColor: tag.color + '22',
        borderColor: tag.color + '55',
        color: tag.color,
      }}
    >
      <span className="wealth-tag-dot" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  )
}

// ── Tag Form Modal ────────────────────────────────────────

function TagFormModal({ tag, onClose, onSave }) {
  const [name, setName] = useState(tag?.name || '')
  const [color, setColor] = useState(tag?.color || TAG_COLORS[0])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      if (tag) {
        await updateWealthTag(tag.id, { name: name.trim(), color })
      } else {
        await createWealthTag({ name: name.trim(), color })
      }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>{tag ? 'Edit Tag' : 'New Tag'}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Investment" autoFocus />
        </div>
        <div className="field">
          <label>Colour</label>
          <div className="color-swatch-grid">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-swatch${color === c ? ' selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Custom:</span>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 36, height: 28, padding: 2, cursor: 'pointer' }}
            />
            <TagPill tag={{ name: name || 'Preview', color }} />
          </div>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : tag ? 'Save changes' : 'Create tag'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Item Form Modal ───────────────────────────────────────

function ItemFormModal({ item, tags, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '')
  const [type, setType] = useState(item?.type || 'asset')
  const [showOnDashboard, setShowOnDashboard] = useState(item?.show_on_dashboard ?? false)
  const [dashboardOrder, setDashboardOrder] = useState(item?.dashboard_order ?? 0)
  const [selectedTagIds, setSelectedTagIds] = useState(item?.tags?.map(t => t.id) || [])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function toggleTag(id) {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        show_on_dashboard: showOnDashboard,
        dashboard_order: parseInt(dashboardOrder) || 0,
        tag_ids: selectedTagIds,
      }
      if (item) {
        await updateWealthItem(item.id, payload)
      } else {
        await createWealthItem(payload)
      }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>{item ? 'Edit Item' : 'New Asset / Liability'}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ANZ Mortgage" autoFocus />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
        </div>

        {tags.length > 0 && (
          <div className="field">
            <label>Tags</label>
            <div className="tag-toggle-list">
              {tags.map(tag => {
                const sel = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-toggle${sel ? ' selected' : ''}`}
                    style={sel ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <span className="wealth-tag-dot" style={{ backgroundColor: sel ? 'var(--bg)' : tag.color }} />
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showOnDashboard}
              onChange={e => setShowOnDashboard(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>Pin to dashboard</span>
          </label>
          {showOnDashboard && (
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <label style={{ whiteSpace: 'nowrap' }}>Order</label>
              <input
                type="number"
                value={dashboardOrder}
                onChange={e => setDashboardOrder(e.target.value)}
                style={{ width: 70 }}
                min={0}
              />
            </div>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────

function DeleteModal({ label, onClose, onConfirm, deleting }) {
  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h2>Delete {label}?</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 13 }}>
        This will permanently delete <strong style={{ color: 'var(--text)' }}>{label}</strong> and all its snapshot data. This cannot be undone.
      </p>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}

// ── Monthly Values Tab ────────────────────────────────────

function MonthlyValuesTab({ tags }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [values, setValues] = useState({})  // item_id -> { value, notes }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setSaved(false)
    try {
      const data = await getSnapshotsByMonth(year, month)
      setRows(data)
      const init = {}
      for (const row of data) {
        init[row.item.id] = {
          value: row.value != null ? String(row.value) : '',
          notes: row.notes || '',
        }
      }
      setValues(init)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { loadRows() }, [loadRows])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  function updateValue(itemId, field, val) {
    setValues(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: val } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const payload = rows
        .filter(row => values[row.item.id]?.value !== '')
        .map(row => ({
          wealth_item_id: row.item.id,
          year,
          month,
          value: parseFloat(values[row.item.id]?.value) || 0,
          notes: values[row.item.id]?.notes || null,
        }))
      await bulkUpsertSnapshots(payload)
      setSaved(true)
      loadRows()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="month-nav">
          <button onClick={prevMonth}>‹</button>
          <span className="month-label">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth}>›</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Saved</span>}
          {error && <span className="error-msg">{error}</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save all values'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>No active items found.</p>
          <p>Add items in the <strong>Items</strong> tab first.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div className="snapshot-row snapshot-row-header" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
            <span>Name</span>
            <span>Type</span>
            <span>Tags</span>
            <span>Value ($)</span>
            <span>Notes</span>
          </div>
          {/* Rows */}
          {rows.map(row => {
            const v = values[row.item.id] || { value: '', notes: '' }
            return (
              <div key={row.item.id} className="snapshot-row" style={{ padding: '8px 20px' }}>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{row.item.name}</span>
                <span>
                  <span className={`badge ${row.item.type === 'asset' ? 'type-badge-asset' : 'type-badge-liability'}`}>
                    {row.item.type === 'asset' ? 'Asset' : 'Liab'}
                  </span>
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {row.item.tags.map(t => <TagPill key={t.id} tag={t} />)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={v.value}
                  onChange={e => updateValue(row.item.id, 'value', e.target.value)}
                  placeholder={row.item.type === 'liability' ? 'e.g. 250000' : 'e.g. 50000'}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                />
                <input
                  type="text"
                  value={v.notes}
                  onChange={e => updateValue(row.item.id, 'notes', e.target.value)}
                  placeholder="Optional note"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Items Tab ─────────────────────────────────────────────

function ItemsTab({ tags, onRefreshTags }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await getWealthItems())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteWealthItem(deleteItem.id)
      setDeleteItem(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  async function toggleDashboard(item) {
    await updateWealthItem(item.id, { show_on_dashboard: !item.show_on_dashboard })
    load()
  }

  async function toggleActive(item) {
    await updateWealthItem(item.id, { is_active: !item.is_active })
    load()
  }

  const visible = showInactive ? items : items.filter(i => i.is_active)
  const assets = visible.filter(i => i.type === 'asset')
  const liabilities = visible.filter(i => i.type === 'liability')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Show inactive items
        </label>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add item</button>
      </div>

      {loading ? <p className="text-muted">Loading…</p> : (
        <>
          {[{ label: 'Assets', rows: assets }, { label: 'Liabilities', rows: liabilities }].map(({ label, rows }) => (
            <div key={label} style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12 }}>{label}</h3>
              {rows.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p>No {label.toLowerCase()} yet. Add one above.</p>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Tags</th>
                          <th>Latest Value</th>
                          <th>Pinned</th>
                          <th>Active</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(item => (
                          <tr key={item.id} style={!item.is_active ? { opacity: 0.5 } : {}}>
                            <td style={{ fontWeight: 500 }}>{item.name}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {item.tags.map(t => <TagPill key={t.id} tag={t} />)}
                              </div>
                            </td>
                            <td className="mono">{fmt(item.latest_value)}</td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                title={item.show_on_dashboard ? 'Unpin from dashboard' : 'Pin to dashboard'}
                                onClick={() => toggleDashboard(item)}
                                style={{ fontSize: 16, padding: '2px 8px' }}
                              >
                                {item.show_on_dashboard ? '★' : '☆'}
                              </button>
                            </td>
                            <td>
                              <button
                                className={`btn btn-sm ${item.is_active ? 'btn-ghost' : 'btn-ghost'}`}
                                onClick={() => toggleActive(item)}
                                style={{ fontSize: 11 }}
                              >
                                {item.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(item)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => setDeleteItem(item)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {addModal && (
        <ItemFormModal
          tags={tags}
          onClose={() => setAddModal(false)}
          onSave={() => { setAddModal(false); load() }}
        />
      )}
      {editItem && (
        <ItemFormModal
          item={editItem}
          tags={tags}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); load() }}
        />
      )}
      {deleteItem && (
        <DeleteModal
          label={deleteItem.name}
          deleting={deleting}
          onClose={() => setDeleteItem(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

// ── Tags Tab ──────────────────────────────────────────────

function TagsTab() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editTag, setEditTag] = useState(null)
  const [deleteTag, setDeleteTag] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTags(await getWealthTags()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteWealthTag(deleteTag.id)
      setDeleteTag(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add tag</button>
      </div>

      {loading ? <p className="text-muted">Loading…</p> : tags.length === 0 ? (
        <div className="empty-state">
          <p>No tags yet. Create tags to organise your assets and liabilities.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Colour</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag.id}>
                    <td><TagPill tag={tag} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: tag.color }} />
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{tag.color}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditTag(tag)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTag(tag)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addModal && (
        <TagFormModal onClose={() => setAddModal(false)} onSave={() => { setAddModal(false); load() }} />
      )}
      {editTag && (
        <TagFormModal tag={editTag} onClose={() => setEditTag(null)} onSave={() => { setEditTag(null); load() }} />
      )}
      {deleteTag && (
        <DeleteModal
          label={deleteTag.name}
          deleting={deleting}
          onClose={() => setDeleteTag(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────

export default function WealthItems() {
  const [activeTab, setActiveTab] = useState('values')
  const [tags, setTags] = useState([])

  const loadTags = useCallback(async () => {
    try { setTags(await getWealthTags()) } catch {}
  }, [])

  useEffect(() => { loadTags() }, [loadTags])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Items &amp; Values</h1>
      </div>

      <div className="tabs" style={{ marginBottom: 28 }}>
        <button className={`tab${activeTab === 'values' ? ' active' : ''}`} onClick={() => setActiveTab('values')}>
          Monthly Values
        </button>
        <button className={`tab${activeTab === 'items' ? ' active' : ''}`} onClick={() => setActiveTab('items')}>
          Items
        </button>
        <button className={`tab${activeTab === 'tags' ? ' active' : ''}`} onClick={() => setActiveTab('tags')}>
          Tags
        </button>
      </div>

      {activeTab === 'values' && <MonthlyValuesTab tags={tags} />}
      {activeTab === 'items' && <ItemsTab tags={tags} onRefreshTags={loadTags} />}
      {activeTab === 'tags' && <TagsTab />}
    </div>
  )
}
