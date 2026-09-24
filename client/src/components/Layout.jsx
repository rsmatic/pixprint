import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLES } from '../lib.js';
import { SettingsContext } from './ui.jsx';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: '▦', end: true },
  { to: '/app/tickets', label: 'Service tickets', icon: '🛠' },
  { to: '/app/schedule', label: 'Schedule', icon: '📅' },
  { to: '/app/customers', label: 'Customers', icon: '👥' },
  { to: '/app/printers', label: 'Printers', icon: '🖨' },
  { to: '/app/users', label: 'Team', icon: '👤', roles: ['admin'] },
  { to: '/app/settings', label: 'Settings', icon: '⚙', roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const settings = useApi('/settings');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SettingsContext.Provider value={{ ...(settings.data || { currency: 'PHP' }), reload: settings.reload }}>
      <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
        <aside className="sidebar">
          <Link to="/app" className="brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">🖨</span>
            <span>
              PixPrint
              <small>{settings.data?.shop_name || 'Repair & Maintenance'}</small>
            </span>
          </Link>
          <nav>
            {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <Link to="/request" target="_blank" rel="noreferrer" className="side-link">
              ↗ Customer request form
            </Link>
            <NavLink to="/app/profile" className="user-chip" onClick={() => setMenuOpen(false)}>
              <span className="avatar">{user.name[0]?.toUpperCase()}</span>
              <span>
                {user.name}
                <small>{ROLES[user.role]}</small>
              </span>
            </NavLink>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button className="btn-icon menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
              ☰
            </button>
            <span className="topbar-title">PixPrint</span>
            <Link to="/app/tickets/new" className="btn btn-primary btn-sm">
              + New ticket
            </Link>
          </header>
          <main className="content">
            <Outlet />
          </main>
        </div>
        <div className="scrim" onClick={() => setMenuOpen(false)} />
      </div>
    </SettingsContext.Provider>
  );
}
