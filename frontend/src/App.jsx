import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './index.css'
import Dashboard from './pages/Dashboard.jsx'
import BillsByMonth from './pages/BillsByMonth.jsx'
import Accounts from './pages/Accounts.jsx'
import Reconcile from './pages/Reconcile.jsx'

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h1>BillTracker</h1>
        <span>HOUSEHOLD FINANCE</span>
      </div>
      <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">◈</span> Dashboard
      </NavLink>
      <NavLink to="/bills" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">≡</span> Bills by Month
      </NavLink>
      <NavLink to="/reconcile" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">⊜</span> Reconcile
      </NavLink>
      <NavLink to="/accounts" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">◎</span> Accounts
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bills" element={<BillsByMonth />} />
            <Route path="/reconcile" element={<Reconcile />} />
            <Route path="/accounts" element={<Accounts />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
