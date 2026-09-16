import { useState, useRef, useEffect } from 'react'

const TAG_COLORS = [
  '#4f7cff', '#2dd87a', '#ff5c5c', '#f5a623',
  '#a855f7', '#06b6d4', '#f97316', '#ec4899',
  '#10b981', '#6366f1', '#fbbf24', '#14b8a6',
]

export function TagPill({ tag, onRemove }) {
  return (
    <span
      className="wealth-tag-pill"
      style={{ backgroundColor: tag.color + '22', borderColor: tag.color + '55', color: tag.color }}
    >
      <span className="wealth-tag-dot" style={{ backgroundColor: tag.color }} />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, lineHeight: 1 }}
        >×</button>
      )}
    </span>
  )
}

// Quick inline tag picker: shows current tags as pills, type to search/create,
// Enter adds, click × removes. `allTags` is the full known tag list (for autocomplete).
export default function TagPicker({ tags, allTags, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const currentIds = new Set(tags.map(t => t.id))
  const suggestions = query
    ? allTags.filter(t => !currentIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase()))
    : allTags.filter(t => !currentIds.has(t.id))

  const exactMatch = allTags.some(t => t.name.toLowerCase() === query.trim().toLowerCase())

  function addExisting(tag) {
    onChange([...tags, tag])
    setQuery('')
    inputRef.current?.focus()
  }

  function addNew() {
    const name = query.trim()
    if (!name) return
    const color = TAG_COLORS[allTags.length % TAG_COLORS.length]
    onChange([...tags, { id: null, name, color }])
    setQuery('')
  }

  function removeTag(id) {
    onChange(tags.filter(t => t.id !== id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const match = suggestions.find(t => t.name.toLowerCase() === query.trim().toLowerCase())
      if (match) addExisting(match)
      else if (query.trim()) addNew()
    } else if (e.key === 'Backspace' && !query && tags.length > 0) {
      removeTag(tags[tags.length - 1].id)
    }
  }

  return (
    <div className="tag-picker" ref={wrapRef}>
      <div className="tag-picker-pills" onClick={() => { setOpen(true); inputRef.current?.focus() }}>
        {tags.map(t => <TagPill key={t.id ?? t.name} tag={t} onRemove={() => removeTag(t.id)} />)}
        <input
          ref={inputRef}
          className="tag-picker-input"
          value={query}
          placeholder={tags.length ? '' : '+ tag'}
          onFocus={() => setOpen(true)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && (query || suggestions.length > 0) && (
        <div className="tag-picker-dropdown">
          {suggestions.slice(0, 8).map(t => (
            <div key={t.id} className="tag-picker-option" onClick={() => addExisting(t)}>
              <TagPill tag={t} />
            </div>
          ))}
          {query.trim() && !exactMatch && (
            <div className="tag-picker-option" onClick={addNew}>
              Create "{query.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
