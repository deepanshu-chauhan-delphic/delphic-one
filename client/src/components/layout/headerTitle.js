import { ROLE_COPY } from '../../pages/dashboard/dashboardWidgets.js';

/** Page title shown in the app header for the active route. */
export function headerTitleForPath(pathname, user) {
  if (pathname === '/') return user?.name ? `${user.name}'s Dashboard` : 'Dashboard';
  if (pathname.startsWith('/pipeline')) return 'Pipeline';
  if (pathname.startsWith('/accounts')) return 'Clients & vendors';
  if (pathname.startsWith('/requirements')) return 'Requirements';
  if (pathname.startsWith('/profiles')) return 'Candidates';
  if (pathname.startsWith('/submissions')) return 'Submissions';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/users')) return 'Users';
  return 'Delphic';
}

/** Subtitle shown directly under the header title on the same canvas background. */
export function headerSubtitleForPath(pathname, user) {
  if (pathname === '/') return ROLE_COPY[user?.role || 'admin']?.subtitle || ROLE_COPY.admin.subtitle;
  if (/^\/pipeline\/[^/]+/.test(pathname)) {
    return 'Requirements as rows, candidates by stage. Drag or use stage buttons.';
  }
  if (pathname.startsWith('/pipeline')) {
    return 'Your role pipeline — leads, jobs, or candidates by stage.';
  }
  if (pathname.startsWith('/accounts')) return 'Track lead ownership, meetings, and account stage.';
  if (pathname.startsWith('/requirements')) return 'Open jobs, seats, and recruiter assignments.';
  if (pathname.startsWith('/profiles')) return 'Profiles with skills, CTC, and resume attachments.';
  if (pathname.startsWith('/submissions')) return 'Candidates put forward for jobs, by pipeline stage.';
  if (pathname.startsWith('/reports')) return 'Pick filters and export Excel or PDF.';
  if (pathname.startsWith('/users')) {
    return 'Only admins can create accounts. Assign a department so reports can filter by team.';
  }
  return '';
}
