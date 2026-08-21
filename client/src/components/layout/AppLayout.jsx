import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/authContext.jsx';
import ChangePasswordModal from '../ChangePasswordModal.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/requirements', label: 'Requirements' },
  { to: '/profiles', label: 'Profiles' },
  { to: '/submissions', label: 'Submissions' },
  { to: '/reports', label: 'Reports' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navItems = user?.role === 'admin' ? [...NAV_ITEMS, { to: '/users', label: 'Users' }] : NAV_ITEMS;
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-white">
        <div className="px-4 py-4 font-heading text-lg font-semibold text-tertiary-900">Delphic</div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-tertiary-600 hover:bg-tertiary-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b bg-white px-4">
          <div className="text-sm text-tertiary-500">Welcome back{user?.name ? `, ${user.name}` : ''}</div>
          <div className="relative flex items-center gap-3" ref={menuRef}>
            <span className="rounded bg-tertiary-100 px-2 py-0.5 text-xs font-medium capitalize text-tertiary-700">
              {user?.role}
            </span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              title="Profile menu"
            >
              {(user?.name || '?').slice(0, 1).toUpperCase()}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-9 z-20 w-48 rounded border bg-white py-1 shadow-md"
              >
                <div className="border-b px-3 py-2 text-xs text-tertiary-500">{user?.email}</div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-tertiary-700 hover:bg-tertiary-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordOpen(true);
                  }}
                >
                  Change password
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-tertiary-700 hover:bg-tertiary-50"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
