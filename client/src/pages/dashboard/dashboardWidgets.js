/**
 * Role-specific home dashboard widgets (RD-113).
 * Values come only from GET /dashboard/summary — no invented series.
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

/**
 * Build KPI cards from real summary fields only.
 */
export function statsForRole(role, summary) {
  if (!summary) return [];

  const stuckLeads = summary.stuck_leads?.length ?? 0;
  const stuckReqs = summary.stuck_requirements?.length ?? 0;

  if (role === 'bda') {
    return [
      { label: 'Active leads', value: summary.leads_active ?? 0, hint: stuckLeads ? `${stuckLeads} stuck 7d+` : 'In lead stage' },
      { label: 'In meeting', value: summary.leads_in_meeting ?? 0, hint: 'Meeting scheduled' },
      { label: 'Active clients', value: summary.clients_active ?? 0, hint: 'Stage = active' },
      { label: 'Active vendors', value: summary.vendors_active ?? 0, hint: 'Stage = active' },
    ];
  }

  if (role === 'sales') {
    return [
      { label: 'Open requirements', value: summary.requirements_open ?? 0, hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Currently open' },
      { label: 'In progress', value: summary.requirements_in_progress ?? 0, hint: 'Being worked' },
      { label: 'Active submissions', value: summary.submissions_active ?? 0, hint: 'In pipeline' },
      { label: 'Interviews this week', value: summary.interviews_scheduled_this_week ?? 0, hint: 'Scheduled this week' },
      { label: 'Closed this month', value: summary.requirements_closed_this_month ?? 0, hint: 'Requirements closed' },
      { label: 'Closures this month', value: summary.closures_this_month ?? 0, hint: 'Joins / seat closures' },
    ];
  }

  if (role === 'recruiter') {
    return [
      { label: 'Assigned open', value: summary.requirements_open ?? 0, hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Assigned to you' },
      { label: 'In progress', value: summary.requirements_in_progress ?? 0, hint: 'Assigned to you' },
      { label: 'Active submissions', value: summary.submissions_active ?? 0, hint: 'Your pipeline' },
      { label: 'Interviews this week', value: summary.interviews_scheduled_this_week ?? 0, hint: 'Scheduled this week' },
      { label: 'Closures this month', value: summary.closures_this_month ?? 0, hint: 'Joins this month' },
    ];
  }

  return [
    { label: 'Active leads', value: summary.leads_active ?? 0, hint: stuckLeads ? `${stuckLeads} stuck 7d+` : 'Company-wide' },
    { label: 'Open requirements', value: summary.requirements_open ?? 0, hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Company-wide' },
    { label: 'Active submissions', value: summary.submissions_active ?? 0, hint: 'In pipeline' },
    { label: 'Interviews this week', value: summary.interviews_scheduled_this_week ?? 0, hint: 'Scheduled this week' },
    { label: 'Closures this month', value: summary.closures_this_month ?? 0, hint: 'Joins this month' },
    { label: 'Active clients', value: summary.clients_active ?? 0, hint: 'Stage = active' },
  ];
}

/** Friendly labels for funnel stage keys from the API. */
export const FUNNEL_STAGE_LABELS = {
  sourced: 'Sourced',
  screening: 'Screening',
  submitted: 'Submitted',
  interviewing: 'Interview',
  offered: 'Offer',
  bgv: 'BGV',
  closed: 'Closed',
};
