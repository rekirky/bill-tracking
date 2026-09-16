import { useState, useRef, useEffect } from 'react'

// Generic "select one/more, or all" dropdown. Empty `selected` means "all".
export default function MultiSelect({ label, options, selected, onChange, getId = (o) => o.id, getLabel = (o) => o.name }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="multiselect" ref={ref}>
      <button type="button" className="multiselect-trigger" onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? `All ${label}` : `${selected.length} of ${options.length} selected`}
      </button>
      {open && (
        <div className="tag-picker-dropdown" style={{ minWidth: 200 }}>
          {options.length === 0 && <div className="tag-picker-option">None yet</div>}
          {options.map((o) => (
            <label key={getId(o)} className="tag-picker-option" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={selected.includes(getId(o))} onChange={() => toggle(getId(o))} />
              {getLabel(o)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
