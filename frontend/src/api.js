const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

// Accounts
export const getAccounts = () => request('GET', '/accounts/')
export const createAccount = (data) => request('POST', '/accounts/', data)
export const updateAccount = (id, data) => request('PATCH', `/accounts/${id}`, data)
export const deleteAccount = (id) => request('DELETE', `/accounts/${id}`)

// Bills
export const getBills = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/bills/${q ? '?' + q : ''}`)
}
export const getBillsByMonth = (year, month) =>
  request('GET', `/bills/by-month?year=${year}&month=${month}`)
export const getDashboard = () => request('GET', '/bills/dashboard')
export const getSpendChart = () => request('GET', '/bills/spend-chart')
export const createBill = (data) => request('POST', '/bills/', data)
export const updateBill = (id, data) => request('PATCH', `/bills/${id}`, data)
export const deleteBill = (id) => request('DELETE', `/bills/${id}`)

// Payments
export const getPayments = (billId) =>
  request('GET', `/payments/${billId ? '?bill_id=' + billId : ''}`)
export const recordPayment = (data) => request('POST', '/payments/', data)
export const deletePayment = (id) => request('DELETE', `/payments/${id}`)

// Money aside
export const getMoneyAside = (billId) =>
  request('GET', `/money-aside/${billId ? '?bill_id=' + billId : ''}`)
export const addMoneyAside = (data) => request('POST', '/money-aside/', data)
export const deleteMoneyAside = (id) => request('DELETE', `/money-aside/${id}`)

// Reconciliation
export const getReconciliations = (accountId) =>
  request('GET', `/reconciliations/${accountId ? '?account_id=' + accountId : ''}`)
export const getLiveTotal = (accountId) =>
  request('GET', `/reconciliations/live-total?account_id=${accountId}`)
export const createReconciliation = (data) => request('POST', '/reconciliations/', data)

// Wealth — Tags
export const getWealthTags = () => request('GET', '/wealth/tags/')
export const createWealthTag = (data) => request('POST', '/wealth/tags/', data)
export const updateWealthTag = (id, data) => request('PATCH', `/wealth/tags/${id}`, data)
export const deleteWealthTag = (id) => request('DELETE', `/wealth/tags/${id}`)

// Wealth — Items
export const getWealthItems = () => request('GET', '/wealth/items/')
export const createWealthItem = (data) => request('POST', '/wealth/items/', data)
export const updateWealthItem = (id, data) => request('PATCH', `/wealth/items/${id}`, data)
export const deleteWealthItem = (id) => request('DELETE', `/wealth/items/${id}`)

// Wealth — Snapshots
export const getSnapshotsByMonth = (year, month) =>
  request('GET', `/wealth/snapshots/by-month?year=${year}&month=${month}`)
export const bulkUpsertSnapshots = (data) => request('POST', '/wealth/snapshots/bulk', data)
export const deleteSnapshot = (id) => request('DELETE', `/wealth/snapshots/${id}`)

// Wealth — Dashboard
export const getWealthDashboard = () => request('GET', '/wealth/dashboard/')

// Barefoot — Settings
export const getBarefootSettings = () => request('GET', '/barefoot/settings/')
export const updateBarefootSettings = (data) => request('PATCH', '/barefoot/settings/', data)

// Barefoot — Income
export const getBarefootIncome = () => request('GET', '/barefoot/income/')
export const createBarefootIncome = (data) => request('POST', '/barefoot/income/', data)
export const updateBarefootIncome = (id, data) => request('PATCH', `/barefoot/income/${id}`, data)
export const deleteBarefootIncome = (id) => request('DELETE', `/barefoot/income/${id}`)

// Barefoot — Monthly Entries
export const getBarefootEntries = (year, month) => request('GET', `/barefoot/entries/?year=${year}&month=${month}`)
export const upsertBarefootEntry = (data) => request('POST', '/barefoot/entries/upsert', data)

// Barefoot — Fire Goals
export const getFireGoals = () => request('GET', '/barefoot/fire-goals/')
export const createFireGoal = (data) => request('POST', '/barefoot/fire-goals/', data)
export const updateFireGoal = (id, data) => request('PATCH', `/barefoot/fire-goals/${id}`, data)
export const deleteFireGoal = (id) => request('DELETE', `/barefoot/fire-goals/${id}`)
export const celebrateFireGoal = (id) => request('POST', `/barefoot/fire-goals/${id}/celebrate`, {})

// Barefoot — Allocations
export const createFireAllocation = (data) => request('POST', '/barefoot/fire-allocations/', data)
export const deleteFireAllocation = (id) => request('DELETE', `/barefoot/fire-allocations/${id}`)

// Barefoot — Bucket Transactions (Smile / Fire)
export const createBucketTransaction = (data) => request('POST', '/barefoot/bucket-transactions/', data)
export const deleteBucketTransaction = (id) => request('DELETE', `/barefoot/bucket-transactions/${id}`)

// Barefoot — Daily Expenses
export const createDailyExpense = (data) => request('POST', '/barefoot/daily-expenses/', data)
export const deleteDailyExpense = (id) => request('DELETE', `/barefoot/daily-expenses/${id}`)

// Barefoot — Dashboard
export const getBarefootDashboard = (year, month) => {
  const q = year && month ? `?year=${year}&month=${month}` : ''
  return request('GET', `/barefoot/dashboard/${q}`)
}

// Barefoot — Linkable liabilities
export const getLinkableLiabilities = () => request('GET', '/barefoot/linkable-liabilities/')
