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
