import {
  LayoutDashboard,
  Building2,
  Columns3,
  Briefcase,
  Users,
  Send,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
} from 'lucide-react';

/**
 * Sidebar nav items. Each item optionally requires a capability from permissions.js.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Building2 },
  { to: '/pipeline', label: 'Pipeline', icon: Columns3, capability: 'viewPipeline' },
  { to: '/requirements', label: 'Requirements', icon: Briefcase },
  { to: '/profiles', label: 'Profiles', icon: Users, capability: 'viewProfiles' },
  { to: '/submissions', label: 'Submissions', icon: Send },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: BarChart3, capability: 'viewReports' },
  { to: '/users', label: 'Users', icon: UserCog, capability: 'manageUsers' },
  { to: '/settings', label: 'Settings', icon: Settings },
];
