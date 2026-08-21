/**
 * Role-specific home dashboard widgets (RD-113).
 * Backend already scopes GET /dashboard/summary per role.
 */

export const ROLE_COPY = {
  admin: {
    subtitle: 'Company-wide leads, jobs, pipeline, and aging alerts.',
  },
  bda: {
    subtitle: 'Your owned accounts — leads, meetings, and stuck follow-ups.',
  },
  sales: {
    subtitle: 'Your owned requirements — openings, submissions, and stuck jobs.',
  },
  recruiter: {
    subtitle: 'Assigned jobs and your active submissions / interviews.',
  },
};

export function statsForRole(role, summary) {
  if (!summary) {
    return [];
  }

  if (role === 'bda') {
    return [
      { label: 'Active leads', value: summary.leads_active },
      { label: 'In meeting', value: summary.leads_in_meeting },
      { label: 'Active clients', value: summary.clients_active },
      { label: 'Active vendors', value: summary.vendors_active },
    ];
  }

  if (role === 'sales') {
    return [
      { label: 'Active clients', value: summary.clients_active },
      { label: 'Open requirements', value: summary.requirements_open },
      { label: 'In progress', value: summary.requirements_in_progress },
      { label: 'Closed this month', value: summary.requirements_closed_this_month },
      { label: 'Active submissions', value: summary.submissions_active },
      { label: 'Interviews this week', value: summary.interviews_scheduled_this_week },
      { label: 'Closures this month', value: summary.closures_this_month },
    ];
  }

  if (role === 'recruiter') {
    return [
      { label: 'Assigned open', value: summary.requirements_open },
      { label: 'Assigned in progress', value: summary.requirements_in_progress },
      { label: 'Active submissions', value: summary.submissions_active },
      { label: 'Interviews this week', value: summary.interviews_scheduled_this_week },
      { label: 'Closures this month', value: summary.closures_this_month },
    ];
  }

  return [
    { label: 'Active leads', value: summary.leads_active },
    { label: 'In meeting', value: summary.leads_in_meeting },
    { label: 'Active clients', value: summary.clients_active },
    { label: 'Active vendors', value: summary.vendors_active },
    { label: 'Open requirements', value: summary.requirements_open },
    { label: 'In progress', value: summary.requirements_in_progress },
    { label: 'Closed this month', value: summary.requirements_closed_this_month },
    { label: 'Active submissions', value: summary.submissions_active },
    { label: 'Interviews this week', value: summary.interviews_scheduled_this_week },
    { label: 'Closures this month', value: summary.closures_this_month },
  ];
}
