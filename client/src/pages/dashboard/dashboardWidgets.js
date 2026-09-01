/**
 * Role-specific home dashboard widgets (RD-113).
 * Values come only from GET /dashboard/summary — no invented series.
 */

import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Send,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

export const KPI_THEMES = ['blue', 'green', 'purple', 'orange', 'red', 'cyan'];

const KPI_ICONS = [Target, Briefcase, Send, Calendar, TrendingUp, Building2, Users, UserCheck];

function withKpiMeta(stats) {
  return stats.map((stat, index) => ({
    ...stat,
    icon: stat.icon || KPI_ICONS[index % KPI_ICONS.length],
    theme: stat.theme || KPI_THEMES[index % KPI_THEMES.length],
  }));
}

/**
 * Where each KPI drills into. Every href carries the exact filter query params
 * the target list page reads on mount, so the user lands on the pre-filtered view.
 */
export const KPI_LINKS = {
  leadsActive: '/accounts?stage=lead',
  leadsInMeeting: '/accounts?stage=meeting_scheduled',
  clientsActive: '/accounts?stage=active&type=client',
  vendorsActive: '/accounts?stage=active&type=vendor',
  requirementsOpen: '/requirements?status=open',
  requirementsInProgress: '/requirements?status=in_progress',
  requirementsClosed: '/requirements?status=closed',
  stuckLeads: '/accounts?stage=lead',
  stuckRequirements: '/requirements?stuck=stuck',
  submissionsActive: '/submissions',
  interviewsThisWeek: '/submissions?stage=interview_scheduled',
  closures: '/submissions?stage=closed',
};

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
    return withKpiMeta([
      {
        label: 'Active leads',
        value: summary.leads_active ?? 0,
        hint: stuckLeads ? `${stuckLeads} stuck 7d+` : 'In lead stage',
        description: 'Your owned accounts currently in the "lead" stage (not yet in a scheduled meeting).',
        href: KPI_LINKS.leadsActive,
      },
      {
        label: 'In meeting',
        value: summary.leads_in_meeting ?? 0,
        hint: 'Meeting scheduled',
        description: 'Your owned accounts with a meeting scheduled or rescheduled.',
        href: KPI_LINKS.leadsInMeeting,
      },
      {
        label: 'Active clients',
        value: summary.clients_active ?? 0,
        hint: 'Stage = active',
        description: 'Your owned client accounts currently at stage = active, as of right now.',
        href: KPI_LINKS.clientsActive,
      },
      {
        label: 'Active vendors',
        value: summary.vendors_active ?? 0,
        hint: 'Stage = active',
        description: 'Your owned vendor accounts currently at stage = active, as of right now.',
        href: KPI_LINKS.vendorsActive,
      },
    ]);
  }

  if (role === 'sales') {
    return withKpiMeta([
      {
        label: 'Open requirements',
        value: summary.requirements_open ?? 0,
        hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Currently open',
        description: 'Requirements you own with status = open right now.',
        href: KPI_LINKS.requirementsOpen,
      },
      {
        label: 'In progress',
        value: summary.requirements_in_progress ?? 0,
        hint: 'Being worked',
        description: 'Requirements you own with status = in_progress right now.',
        href: KPI_LINKS.requirementsInProgress,
      },
      {
        label: 'Active submissions',
        value: summary.submissions_active ?? 0,
        hint: 'In pipeline',
        description: 'Submissions against your requirements not yet closed, rejected, or backed out.',
        href: KPI_LINKS.submissionsActive,
      },
      {
        label: 'Interviews this week',
        value: summary.interviews_scheduled_this_week ?? 0,
        hint: 'Scheduled this week',
        description: 'Interview rounds on your requirements completed or scheduled since the start of this week.',
        href: KPI_LINKS.interviewsThisWeek,
      },
      {
        label: 'Closed this month',
        value: summary.requirements_closed_this_month ?? 0,
        hint: 'Requirements closed',
        description: 'Your requirements whose status became closed since the start of this month.',
        href: KPI_LINKS.requirementsClosed,
      },
      {
        label: 'Closures this month',
        value: summary.closures_this_month ?? 0,
        hint: 'Joins / seat closures',
        description: 'Submissions on your requirements with an actual joining date this month.',
        href: KPI_LINKS.closures,
      },
    ]);
  }

  if (role === 'recruiter') {
    return withKpiMeta([
      {
        label: 'Assigned open',
        value: summary.requirements_open ?? 0,
        hint: stuckReqs ? `${stuckReqs} stuck 7d+` : 'Assigned to you',
        description: 'Requirements assigned to you with status = open right now.',
        href: KPI_LINKS.requirementsOpen,
      },
      {
        label: 'In progress',
        value: summary.requirements_in_progress ?? 0,
        hint: 'Assigned to you',
        description: 'Requirements assigned to you with status = in_progress right now.',
        href: KPI_LINKS.requirementsInProgress,
      },
      {
        label: 'Active submissions',
        value: summary.submissions_active ?? 0,
        hint: 'Your pipeline',
        description: 'Submissions you made that are not yet closed, rejected, or backed out.',
        href: KPI_LINKS.submissionsActive,
      },
      {
        label: 'Interviews this week',
        value: summary.interviews_scheduled_this_week ?? 0,
        hint: 'Scheduled this week',
        description: 'Interview rounds on your submissions completed or scheduled since the start of this week.',
        href: KPI_LINKS.interviewsThisWeek,
      },
      {
        label: 'Closures this month',
        value: summary.closures_this_month ?? 0,
        hint: 'Joins this month',
        description: 'Your submissions with an actual joining date this month.',
        href: KPI_LINKS.closures,
      },
    ]);
  }

  return withKpiMeta([
    {
      label: 'Active leads',
      value: summary.leads_active ?? 0,
      hint: 'Company-wide',
      description: 'All accounts company-wide currently in the "lead" stage — any type, including unclassified.',
      icon: Target,
      theme: 'blue',
      href: KPI_LINKS.leadsActive,
    },
    {
      label: 'Open requirements',
      value: summary.requirements_open ?? 0,
      hint: 'Status = open',
      description: 'All requirements company-wide with status = open right now.',
      icon: Briefcase,
      theme: 'green',
      href: KPI_LINKS.requirementsOpen,
    },
    {
      label: 'In progress',
      value: summary.requirements_in_progress ?? 0,
      hint: 'Requirements',
      description: 'All requirements company-wide with status = in_progress right now.',
      icon: ClipboardList,
      theme: 'orange',
      href: KPI_LINKS.requirementsInProgress,
    },
    {
      label: 'Active submissions',
      value: summary.submissions_active ?? 0,
      hint: 'In pipeline',
      description: 'All submissions company-wide not yet closed, rejected, or backed out.',
      icon: Send,
      theme: 'purple',
      href: KPI_LINKS.submissionsActive,
    },
    {
      label: 'Interviews this week',
      value: summary.interviews_scheduled_this_week ?? 0,
      hint: 'Scheduled this week',
      description: 'Interview rounds completed or scheduled since the start of this week, company-wide.',
      icon: Calendar,
      theme: 'orange',
      href: KPI_LINKS.interviewsThisWeek,
    },
    {
      label: 'Closures this month',
      value: summary.closures_this_month ?? 0,
      hint: 'Joins this month',
      description: 'All submissions company-wide with an actual joining date this month.',
      icon: TrendingUp,
      theme: 'red',
      href: KPI_LINKS.closures,
    },
    {
      label: 'Active clients',
      value: summary.clients_active ?? 0,
      hint: 'Stage = active',
      description: 'All client accounts company-wide currently at stage = active, as of right now.',
      icon: Building2,
      theme: 'cyan',
      href: KPI_LINKS.clientsActive,
    },
    {
      label: 'Active vendors',
      value: summary.vendors_active ?? 0,
      hint: 'Stage = active',
      description: 'All vendor accounts company-wide currently at stage = active, as of right now.',
      icon: Users,
      theme: 'blue',
      href: KPI_LINKS.vendorsActive,
    },
    {
      label: 'Stuck leads',
      value: stuckLeads,
      hint: '7+ days in stage',
      description: 'Accounts in a lead / meeting stage with no movement for 7+ days (top 5 shown below).',
      icon: AlertTriangle,
      theme: 'red',
      href: KPI_LINKS.stuckLeads,
    },
    {
      label: 'Stuck requirements',
      value: stuckReqs,
      hint: '7+ days open',
      description: 'Open / in-progress requirements with no movement for 7+ days (top 5 shown below).',
      icon: AlertTriangle,
      theme: 'red',
      href: KPI_LINKS.stuckRequirements,
    },
  ]);
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
  lead: 'Lead',
  meeting_scheduled: 'Meeting scheduled',
  rescheduled: 'Rescheduled',
  active: 'Active',
  dropped: 'Dropped',
};

export const SUBMISSION_FUNNEL_ORDER = [
  'sourced',
  'screening',
  'submitted',
  'interviewing',
  'offered',
  'bgv',
  'closed',
];

export const ACCOUNT_FUNNEL_ORDER = [
  'lead',
  'meeting_scheduled',
  'rescheduled',
  'active',
  'dropped',
];

/** Dashboard funnel keys → submission list filter values */
export const SUBMISSION_STAGE_FILTER = {
  sourced: 'sourced',
  screening: 'internal_screening',
  submitted: 'submitted_to_client',
  interviewing: 'interview_scheduled',
  offered: 'offer',
  bgv: 'bgv',
  closed: 'closed',
};

export function funnelChartData(funnel, role = 'admin') {
  const order = role === 'bda' ? ACCOUNT_FUNNEL_ORDER : SUBMISSION_FUNNEL_ORDER;
  return order.map((stage) => ({
    stage,
    label: FUNNEL_STAGE_LABELS[stage] || stage,
    count: funnel?.[stage] || 0,
  }));
}

export function stageFilterHref(stage, role) {
  if (role === 'bda') return `/accounts?stage=${encodeURIComponent(stage)}`;
  const filterStage = SUBMISSION_STAGE_FILTER[stage];
  return filterStage ? `/submissions?stage=${encodeURIComponent(filterStage)}` : '/submissions';
}
