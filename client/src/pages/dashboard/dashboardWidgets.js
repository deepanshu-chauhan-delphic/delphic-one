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
      {
        label: 'Active leads',
        value: summary.leads_active ?? 0,
        hint: stuckLeads ? `${stuckLeads} stuck 7d+` : 'In lead stage',
        description: 'Your owned accounts currently in the "lead" stage (not yet in a scheduled meeting).',
      },
      {
        label: 'In meeting',
        value: summary.leads_in_meeting ?? 0,
        hint: 'Meeting scheduled',
        description: 'Your owned accounts with a meeting scheduled or rescheduled.',
      },
      {
        label: 'Active clients',
        value: summary.clients_active ?? 0,
        hint: 'Stage = active',
        description: 'Your owned client accounts currently at stage = active, as of right now.',
      },
      {
        label: 'Active vendors',
        value: summary.vendors_active ?? 0,
        hint: 'Stage = active',
        description: 'Your owned vendor accounts currently at stage = active, as of right now.',
      },
    ];
  }

  if (role === 'sales') {
    return [
      {
        label: 'Open requirements',
        value: summary.requirements_open ?? 0,
        hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Currently open',
        description: 'Requirements you own with status = open right now.',
      },
      {
        label: 'In progress',
        value: summary.requirements_in_progress ?? 0,
        hint: 'Being worked',
        description: 'Requirements you own with status = in_progress right now.',
      },
      {
        label: 'Active submissions',
        value: summary.submissions_active ?? 0,
        hint: 'In pipeline',
        description: 'Submissions against your requirements not yet closed, rejected, or backed out.',
      },
      {
        label: 'Interviews this week',
        value: summary.interviews_scheduled_this_week ?? 0,
        hint: 'Scheduled this week',
        description: 'Interview rounds on your requirements completed or scheduled since the start of this week.',
      },
      {
        label: 'Closed this month',
        value: summary.requirements_closed_this_month ?? 0,
        hint: 'Requirements closed',
        description: 'Your requirements whose status became closed since the start of this month.',
      },
      {
        label: 'Closures this month',
        value: summary.closures_this_month ?? 0,
        hint: 'Joins / seat closures',
        description: 'Submissions on your requirements with an actual joining date this month.',
      },
    ];
  }

  if (role === 'recruiter') {
    return [
      {
        label: 'Assigned open',
        value: summary.requirements_open ?? 0,
        hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Assigned to you',
        description: 'Requirements assigned to you with status = open right now.',
      },
      {
        label: 'In progress',
        value: summary.requirements_in_progress ?? 0,
        hint: 'Assigned to you',
        description: 'Requirements assigned to you with status = in_progress right now.',
      },
      {
        label: 'Active submissions',
        value: summary.submissions_active ?? 0,
        hint: 'Your pipeline',
        description: 'Submissions you made that are not yet closed, rejected, or backed out.',
      },
      {
        label: 'Interviews this week',
        value: summary.interviews_scheduled_this_week ?? 0,
        hint: 'Scheduled this week',
        description: 'Interview rounds on your submissions completed or scheduled since the start of this week.',
      },
      {
        label: 'Closures this month',
        value: summary.closures_this_month ?? 0,
        hint: 'Joins this month',
        description: 'Your submissions with an actual joining date this month.',
      },
    ];
  }

  return [
    {
      label: 'Active leads',
      value: summary.leads_active ?? 0,
      hint: stuckLeads ? `${stuckLeads} stuck 7d+` : 'Company-wide',
      description: 'All client accounts company-wide currently in the "lead" stage.',
    },
    {
      label: 'Open requirements',
      value: summary.requirements_open ?? 0,
      hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Company-wide',
      description: 'All requirements company-wide with status = open right now.',
    },
    {
      label: 'Active submissions',
      value: summary.submissions_active ?? 0,
      hint: 'In pipeline',
      description: 'All submissions company-wide not yet closed, rejected, or backed out.',
    },
    {
      label: 'Interviews this week',
      value: summary.interviews_scheduled_this_week ?? 0,
      hint: 'Scheduled this week',
      description: 'Interview rounds completed or scheduled since the start of this week, company-wide.',
    },
    {
      label: 'Closures this month',
      value: summary.closures_this_month ?? 0,
      hint: 'Joins this month',
      description: 'All submissions company-wide with an actual joining date this month.',
    },
    {
      label: 'Active clients',
      value: summary.clients_active ?? 0,
      hint: 'Stage = active',
      description: 'All client accounts company-wide currently at stage = active, as of right now.',
    },
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
  // BDA dashboard shows an account-stage funnel instead of the submission funnel.
  lead: 'Lead',
  meeting_scheduled: 'Meeting scheduled',
  rescheduled: 'Rescheduled',
  active: 'Active',
  dropped: 'Dropped',
};
