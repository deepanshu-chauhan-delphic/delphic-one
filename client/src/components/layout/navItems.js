import {
  LayoutDashboard,
  Building2,
  Columns3,
  Briefcase,
  Users,
  Send,
  BarChart3,
  CalendarDays,
  Clock,
  Wallet,
  Banknote,
  Network,
  Settings,
} from 'lucide-react';

/**
 * Sidebar nav items. Each item optionally requires a capability from permissions.js.
 * `groupSuperadminOnly` items are filtered separately in AppLayout (a per-user
 * flag, not a role capability — see permissions.js for why).
 *
 * Hubs (People, Time & Attendance, Finance) each land on a single page with
 * an internal tab strip rather than adding a sidebar entry per sub-resource —
 * keeps the sidebar from growing one row per new ERP module.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Building2 },
  { to: '/pipeline', label: 'Pipeline', icon: Columns3, capability: 'viewPipeline' },
  { to: '/requirements', label: 'Requirements', icon: Briefcase },
  { to: '/profiles', label: 'Profiles', icon: Users, capability: 'viewProfiles' },
  { to: '/submissions', label: 'Submissions', icon: Send },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/people', label: 'People', icon: Users, capability: 'viewPeople' },
  { to: '/attendance', label: 'Time & Attendance', icon: Clock, capability: 'viewAttendance' },
  { to: '/finance', label: 'Finance', icon: Wallet, capability: 'viewExpenses' },
  { to: '/payroll', label: 'Payroll', icon: Banknote, capability: 'viewPayroll' },
  { to: '/reports', label: 'Reports', icon: BarChart3, capability: 'viewReports' },
  { to: '/group-overview', label: 'Group Overview', icon: Network, groupSuperadminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];
