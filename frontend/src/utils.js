export const fmt = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0)

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const FREQ_LABELS = {
  once: 'Once',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  six_monthly: 'Six-monthly',
  annually: 'Annually',
}

export function progressClass(pct) {
  if (pct >= 100) return 'green'
  if (pct >= 50)  return 'amber'
  return 'red'
}
