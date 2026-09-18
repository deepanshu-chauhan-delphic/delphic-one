import { ROLE_COPY } from '../../pages/dashboard/dashboardWidgets.js';

/** Page title shown in the app header for the active route. */
export function headerTitleForPath(pathname, user) {
  if (pathname === '/') return user?.name ? `${user.name}'s Dashboard` : 'Dashboard';
  if (pathname.startsWith('/pipeline')) return 'Pipeline';
  if (pathname.startsWith('/accounts')) return 'Clients & vendors';
  if (pathname.startsWith('/requirements')) return 'Requirements';
  if (pathname.startsWith('/profiles')) return 'Candidates';
  if (pathname.startsWith('/submissions')) return 'Submissions';
  if (pathname.startsWith('/calendar')) return 'Calendar';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/group-overview')) return 'Group Overview';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/payroll')) return 'Payroll';
  if (/^\/people\/[^/]+$/.test(pathname)) return 'Employee profile';
  if (pathname.startsWith('/people')) return 'People';
  if (pathname.startsWith('/attendance')) return 'Time & Attendance';
  return user?.active_org?.name || 'Workspace';
}

/** Subtitle shown directly under the header title on the same canvas background. */
export function headerSubtitleForPath(pathname, user) {
  if (pathname === '/') return ROLE_COPY[user?.role || 'admin']?.subtitle || ROLE_COPY.admin.subtitle;
  if (/^\/pipeline\/[^/]+/.test(pathname)) {
    return 'Requirements as rows, candidates by stage. Drag or use stage buttons.';
  }
  if (pathname.startsWith('/pipeline')) {
    return 'Your role pipeline - leads, jobs, or candidates by stage.';
  }
  if (pathname.startsWith('/accounts')) return 'Track lead ownership, meetings, and account stage.';
  if (pathname.startsWith('/requirements')) return 'Open jobs, seats, and recruiter assignments.';
  if (pathname.startsWith('/profiles')) return 'Profiles with skills, CTC, and resume attachments.';
  if (pathname.startsWith('/submissions')) return 'Candidates put forward for jobs, by pipeline stage.';
  if (pathname.startsWith('/calendar')) return 'Your scheduled and upcoming interviews - month grid or agenda.';
  if (pathname.startsWith('/notifications')) return 'Assignments, interviews, and stage changes across your work.';
  if (pathname.startsWith('/settings')) return 'Your profile, password, notifications, and account history.';
  if (pathname.startsWith('/reports')) return 'Pick filters and export Excel or PDF.';
  if (pathname.startsWith('/group-overview')) {
    return 'Group-wide valuation, revenue vs. expense, and drill-down into any subsidiary.';
  }
  if (pathname.startsWith('/finance')) return 'Expenses, vendor payments, billing rates, accounting, group charges, and CA/audit access.';
  if (pathname.startsWith('/payroll')) return 'Salary structures, payroll runs, and payslips.';
  if (/^\/people\/[^/]+$/.test(pathname)) return 'Employee directory, organization details, and reporting context.';
  if (pathname.startsWith('/people')) {
    return 'Directory, org chart, users, and HR settings in one place.';
  }
  if (pathname.startsWith('/attendance')) return 'Attendance, leave, and timesheets in one place.';
  return '';
}
