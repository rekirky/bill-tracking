import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import './index.css'
import Dashboard from './pages/Dashboard.jsx'
import BillsByMonth from './pages/BillsByMonth.jsx'
import Accounts from './pages/Accounts.jsx'
import Reconcile from './pages/Reconcile.jsx'
import WealthDashboard from './pages/WealthDashboard.jsx'
import WealthItems from './pages/WealthItems.jsx'

function NavSection({ label }) {
  return <div className="nav-section">{label}</div>
}

function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <nav className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <h1>BillTracker</h1>
          <span>HOUSEHOLD FINANCE</span>
        </div>

        <NavSection label="Bills" />
        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">◈</span> Dashboard
        </NavLink>
        <NavLink to="/bills" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">≡</span> Bills by Month
        </NavLink>
        <NavLink to="/reconcile" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">⊜</span> Reconcile
        </NavLink>
        <NavLink to="/accounts" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">◎</span> Accounts
        </NavLink>

        <NavSection label="Asset Tracking" />
        <NavLink to="/wealth" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">◬</span> Dashboard
        </NavLink>
        <NavLink to="/wealth/items" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={onClose}>
          <span className="nav-icon">◫</span> Items &amp; Values
        </NavLink>
      </nav>
    </>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-wrapper">
          <div className="topbar">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">BillTracker</span>
          </div>
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bills" element={<BillsByMonth />} />
              <Route path="/reconcile" element={<Reconcile />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/wealth" element={<WealthDashboard />} />
              <Route path="/wealth/items" element={<WealthItems />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
