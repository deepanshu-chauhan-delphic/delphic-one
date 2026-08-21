import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/authContext.jsx';

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

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-4 text-lg font-heading font-semibold text-tertiary-900">Delphic</div>
        <nav className="flex-1 px-2 space-y-1">
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b bg-white flex items-center justify-between px-4">
          <div className="text-sm text-tertiary-500">Welcome back{user?.name ? `, ${user.name}` : ''}</div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-tertiary-100 px-2 py-0.5 text-xs font-medium capitalize text-tertiary-700">
              {user?.role}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
              {(user?.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <button type="button" className="btn-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
