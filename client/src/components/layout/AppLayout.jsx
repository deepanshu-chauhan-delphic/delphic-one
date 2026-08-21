import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext.jsx';
import { usePermissions } from '../../lib/permissions.js';
import ChangePasswordDrawer from '../ChangePasswordDrawer.jsx';
import IconButton from '../ui/IconButton.jsx';
import Avatar from '../ui/Avatar.jsx';
import { NAV_ITEMS } from './navItems.js';

const SIDEBAR_KEY = 'delphic_sidebar_collapsed';

/**
 * App shell: collapsible icon sidebar, header with search/actions, and main outlet.
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { can } = usePermissions(user);
  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.capability || can(item.capability)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- can is derived from user.role
    [user?.role]
  );

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    function onDocClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => !v);
  }

  const sidebarWidth = collapsed ? 64 : 224;

  const navContent = (
    <>
      <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white">
          D
        </div>
        {!collapsed && (
          <span className="font-heading text-lg font-semibold text-tertiary-900">Delphic</span>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-tertiary-600 hover:bg-tertiary-50 hover:text-tertiary-900'
                } ${collapsed ? 'justify-center px-2' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="hidden border-t p-2 md:block">
        <button
          type="button"
          className="btn-ghost flex w-full items-center justify-center gap-2 px-3 py-2"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <motion.aside
        className="relative z-20 hidden shrink-0 flex-col border-r bg-white md:flex"
        animate={{ width: sidebarWidth }}
        transition={{ type: 'tween', duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        initial={false}
      >
        {navContent}
      </motion.aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="relative z-10 flex h-full w-56 flex-col border-r bg-white shadow-drawer"
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                className="absolute right-2 top-3 rounded-xl p-1.5 text-tertiary-400 hover:bg-tertiary-100"
                aria-label="Close"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
              {navContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-white px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="rounded-xl p-2 text-tertiary-600 hover:bg-tertiary-50 md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <label className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-400" />
              <input
                type="search"
                placeholder="Search…"
                className="w-full rounded-full border bg-tertiary-50 py-2 pl-9 pr-14 text-sm text-tertiary-800 placeholder:text-tertiary-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                aria-label="Global search"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-medium text-tertiary-400">
                ⌘F
              </kbd>
            </label>
          </div>

          <div className="relative flex items-center gap-2" ref={menuRef}>
            <IconButton icon={Bell} label="Notifications" />
            <IconButton icon={HelpCircle} label="Help" />
            <IconButton icon={Settings} label="Settings" />
            <span className="hidden rounded-full bg-tertiary-100 px-2.5 py-0.5 text-xs font-medium capitalize text-tertiary-700 sm:inline">
              {user?.role}
            </span>
            <button
              type="button"
              className="rounded-full transition-opacity hover:opacity-90"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              title="Profile menu"
            >
              <Avatar name={user?.name} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  className="absolute right-0 top-11 z-20 w-52 rounded-xl border bg-white py-1 shadow-soft"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="border-b px-3 py-2">
                    <div className="text-sm font-medium text-tertiary-900">{user?.name}</div>
                    <div className="text-xs text-tertiary-500">{user?.email}</div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-tertiary-700 transition-colors hover:bg-tertiary-50"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-tertiary-700 transition-colors hover:bg-tertiary-50"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordDrawer open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
