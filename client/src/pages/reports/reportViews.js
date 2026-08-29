import { rangeForPreset } from '../../lib/datePresets.js';

/**
 * Report view helpers for RD-114 — columns, charts, and role visibility.
 */

export const ALL_REPORTS = [
  { key: 'pipeline-explorer', label: 'Pipeline explorer', roles: ['admin', 'sales', 'recruiter', 'bda'] },
  { key: 'bda-performance', label: 'BDA performance', roles: ['admin'] },
  { key: 'sales-performance', label: 'Sales performance', roles: ['admin'] },
  { key: 'recruiter-performance', label: 'Recruiter performance', roles: ['admin', 'sales', 'recruiter'] },
  { key: 'vendor-performance', label: 'Vendor performance', roles: ['admin', 'sales'] },
  { key: 'client-performance', label: 'Client performance', roles: ['admin', 'sales'] },
  { key: 'aging', label: 'Aging / SLA', roles: ['admin', 'sales'] },
  { key: 'closure', label: 'Closure report', roles: ['admin', 'sales'] },
];

export function reportsForRole(role) {
  return ALL_REPORTS.filter((r) => r.roles.includes(role));
}

export function defaultDateRange() {
  const range = rangeForPreset('this_month');
  return { dateFrom: range.date_from, dateTo: range.date_to };
}

function cell(value) {
  if (value == null) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(1);
  return String(value);
}

export function personName(row, key) {
  return row?.[key]?.name || '—';
}

export function columnsForReport(reportKey) {
  if (reportKey === 'pipeline-explorer') {
    return [
      { key: 'client', header: 'Client', render: (r) => r.client?.name || '—' },
      { key: 'bda', header: 'BDA', render: (r) => r.bda?.name || '—' },
      { key: 'requirement', header: 'Requirement', render: (r) => r.requirement?.title || '—' },
      { key: 'status', header: 'Status', render: (r) => r.requirement?.status || '—' },
      { key: 'sales', header: 'Sales', render: (r) => r.sales_owner?.name || '—' },
      {
        key: 'recruiters',
        header: 'Recruiters',
        render: (r) => (r.recruiters || []).map((person) => person.name).join(', ') || '—',
      },
      { key: 'subs', header: 'Subs', render: (r) => r.submissions?.total ?? 0 },
      { key: 'active', header: 'Active', render: (r) => r.submissions?.active ?? 0 },
      { key: 'closed', header: 'Closed', render: (r) => r.submissions?.closed ?? 0 },
      { key: 'days_open', header: 'Days open', render: (r) => cell(r.aging?.days_open) },
      { key: 'stuck', header: 'Stuck', render: (r) => (r.aging?.is_stuck ? 'Yes' : 'No') },
      {
        key: 'sla',
        header: 'SLA overdue',
        render: (r) => (r.aging?.sla_overdue_by_days > 0 ? r.aging.sla_overdue_by_days : '—'),
      },
    ];
  }
  if (reportKey === 'bda-performance') {
    return [
      { key: 'name', header: 'BDA', render: (r) => personName(r, 'bda') },
      { key: 'leads_created', header: 'Leads' },
      { key: 'leads_in_meeting', header: 'In meeting' },
      { key: 'leads_converted_active', header: 'Converted' },
      { key: 'leads_dropped', header: 'Dropped' },
      { key: 'conversion_rate_percentage', header: 'Conv %', render: (r) => cell(r.conversion_rate_percentage) },
      { key: 'vendors_created', header: 'Vendors added' },
      { key: 'leads_unclassified', header: 'Unclassified' },
      { key: 'leads_via_linkedin', header: 'Via LinkedIn' },
      { key: 'avg_days_lead_to_meeting', header: 'Avg d lead→meeting', render: (r) => cell(r.avg_days_lead_to_meeting) },
      { key: 'clients_active_current', header: 'Active clients (now)' },
      { key: 'vendors_active_current', header: 'Active vendors (now)' },
      { key: 'stuck_leads_current', header: 'Stuck 7d+ (now)' },
    ];
  }
  if (reportKey === 'recruiter-performance') {
    return [
      { key: 'name', header: 'Recruiter', render: (r) => personName(r, 'recruiter') },
      { key: 'profiles_sourced', header: 'Sourced' },
      { key: 'submissions_total', header: 'Subs' },
      { key: 'submissions_in_interview', header: 'Interview' },
      { key: 'submissions_closed', header: 'Closed' },
      { key: 'closures_count', header: 'Joinings' },
      { key: 'backout_rate_percentage', header: 'Backout %', render: (r) => cell(r.backout_rate_percentage) },
      { key: 'avg_days_total_cycle', header: 'Avg cycle d', render: (r) => cell(r.avg_days_total_cycle) },
      { key: 'interviews_total', header: 'Interviews' },
      { key: 'rounds_missing_mandatory_count', header: 'Missing mandatory rounds' },
    ];
  }
  if (reportKey === 'sales-performance') {
    return [
      { key: 'name', header: 'Sales', render: (r) => personName(r, 'sales_person') },
      { key: 'requirements_opened', header: 'Reqs opened' },
      { key: 'requirements_in_progress', header: 'In progress' },
      { key: 'requirements_closed', header: 'Req closed' },
      { key: 'closures_count', header: 'Joinings' },
      { key: 'total_closed_revenue', header: 'Revenue', render: (r) => cell(r.total_closed_revenue) },
      { key: 'total_margin_generated', header: 'Margin', render: (r) => cell(r.total_margin_generated) },
      { key: 'clients_active', header: 'Active clients' },
      { key: 'avg_closure_days', header: 'Avg close d', render: (r) => cell(r.avg_closure_days) },
      { key: 'submissions_missing_hr_cto_ceo_round', header: 'Missing HR/CTO/CEO round' },
    ];
  }
  if (reportKey === 'vendor-performance') {
    return [
      { key: 'name', header: 'Vendor', render: (r) => personName(r, 'vendor') },
      { key: 'profiles_submitted', header: 'Submitted' },
      { key: 'profiles_interviewed', header: 'Interviewed' },
      { key: 'profiles_closed', header: 'Closed' },
      { key: 'profiles_backout', header: 'Backout' },
      { key: 'backout_rate_percentage', header: 'Backout %', render: (r) => cell(r.backout_rate_percentage) },
      { key: 'total_margin', header: 'Margin', render: (r) => cell(r.total_margin) },
      { key: 'reliability_score', header: 'Reliability', render: (r) => cell(r.reliability_score) },
    ];
  }
  if (reportKey === 'client-performance') {
    return [
      { key: 'name', header: 'Client', render: (r) => personName(r, 'client') },
      { key: 'requirements_total', header: 'Reqs' },
      { key: 'requirements_open', header: 'Open' },
      { key: 'requirements_closed', header: 'Closed' },
      { key: 'submissions_total', header: 'Subs' },
      { key: 'submissions_closed', header: 'Subs closed' },
      { key: 'avg_days_to_close', header: 'Avg d to close', render: (r) => cell(r.avg_days_to_close) },
      { key: 'total_revenue', header: 'Revenue', render: (r) => cell(r.total_revenue) },
      { key: 'total_margin', header: 'Margin', render: (r) => cell(r.total_margin) },
      { key: 'stuck_requirements_count', header: 'Stuck reqs' },
    ];
  }
  if (reportKey === 'closure') {
    return [
      { key: 'group_label', header: 'Group' },
      { key: 'closures_count', header: 'Closures' },
      { key: 'total_revenue', header: 'Revenue', render: (r) => cell(r.total_revenue) },
      { key: 'total_margin', header: 'Margin', render: (r) => cell(r.total_margin) },
      { key: 'avg_cycle_days', header: 'Avg cycle d', render: (r) => cell(r.avg_cycle_days) },
      { key: 'details', header: 'Details', render: (r) => (r.details || []).length },
    ];
  }
  return [];
}

export function tableRowsForReport(reportKey, data) {
  if (!data) return [];
  if (reportKey === 'aging') return [];
  if (reportKey === 'pipeline-explorer') {
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return rows.map((row, index) => ({
      id: row.id || `explorer-${index}`,
      ...row,
    }));
  }
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => ({
    id: row.recruiter?.id || row.sales_person?.id || row.bda?.id || row.vendor?.id || row.client?.id || row.group_label || String(index),
    ...row,
  }));
}

export function agingSections(data) {
  if (!data || typeof data !== 'object') return [];
  return [
    {
      key: 'stuck_leads',
      title: 'Stuck leads',
      columns: [
        { key: 'name', header: 'Account', render: (r) => r.account?.name },
        { key: 'stage', header: 'Stage', render: (r) => r.account?.stage },
        { key: 'owner', header: 'BDA', render: (r) => r.owner?.name || r.bda?.name },
        { key: 'requirements_count', header: 'Reqs' },
        { key: 'days_in_stage', header: 'Days in stage' },
      ],
      rows: (data.stuck_leads || []).map((r, i) => ({ id: r.account?.id || `lead-${i}`, ...r })),
    },
    {
      key: 'stuck_requirements',
      title: 'Stuck requirements',
      columns: [
        { key: 'title', header: 'Requirement', render: (r) => r.requirement?.title },
        { key: 'client', header: 'Client', render: (r) => r.client?.name },
        { key: 'bda', header: 'BDA', render: (r) => r.bda?.name },
        { key: 'status', header: 'Status', render: (r) => r.requirement?.status },
        { key: 'owner', header: 'Sales', render: (r) => r.sales_owner?.name },
        {
          key: 'recruiters',
          header: 'Recruiters',
          render: (r) => (r.recruiters || []).map((person) => person.name).join(', ') || '—',
        },
        { key: 'days_open', header: 'Days open' },
        { key: 'days_since_last_activity', header: 'Days idle' },
        { key: 'submissions_count', header: 'Subs' },
      ],
      rows: (data.stuck_requirements || []).map((r, i) => ({ id: r.requirement?.id || `req-${i}`, ...r })),
    },
    {
      key: 'stuck_submissions',
      title: 'Stuck submissions',
      columns: [
        { key: 'profile', header: 'Candidate', render: (r) => r.profile?.name },
        { key: 'requirement', header: 'Job', render: (r) => r.requirement?.title },
        { key: 'client', header: 'Client', render: (r) => r.client?.name },
        { key: 'bda', header: 'BDA', render: (r) => r.bda?.name },
        { key: 'sales', header: 'Sales', render: (r) => r.sales_owner?.name },
        { key: 'stage', header: 'Stage', render: (r) => r.submission?.stage },
        { key: 'recruiter', header: 'Recruiter', render: (r) => r.recruiter?.name },
        { key: 'days_in_current_stage', header: 'Days in stage' },
      ],
      rows: (data.stuck_submissions || []).map((r, i) => ({ id: r.submission?.id || `sub-${i}`, ...r })),
    },
    {
      key: 'past_sla_requirements',
      title: 'Past SLA',
      columns: [
        { key: 'title', header: 'Requirement', render: (r) => r.requirement?.title },
        { key: 'client', header: 'Client', render: (r) => r.client?.name },
        { key: 'bda', header: 'BDA', render: (r) => r.bda?.name },
        { key: 'sales', header: 'Sales', render: (r) => r.sales_owner?.name },
        {
          key: 'recruiters',
          header: 'Recruiters',
          render: (r) => (r.recruiters || []).map((person) => person.name).join(', ') || '—',
        },
        { key: 'sla_days', header: 'SLA days', render: (r) => r.requirement?.sla_days },
        { key: 'days_open', header: 'Days open' },
        { key: 'overdue_by_days', header: 'Overdue by' },
      ],
      rows: (data.past_sla_requirements || []).map((r, i) => ({ id: r.requirement?.id || `sla-${i}`, ...r })),
    },
  ];
}

export function chartDataForReport(reportKey, data) {
  if (reportKey === 'pipeline-explorer' && data && Array.isArray(data.rows)) {
    const stuck = data.rows.filter((row) => row.aging?.is_stuck).length;
    const sla = data.rows.filter((row) => row.aging?.sla_overdue_by_days > 0).length;
    return [
      { label: 'Rows', value: data.rows.length },
      { label: 'Stuck', value: stuck },
      { label: 'Past SLA', value: sla },
    ];
  }
  if (reportKey === 'aging' && data && typeof data === 'object') {
    return [
      { label: 'Stuck leads', value: (data.stuck_leads || []).length },
      { label: 'Stuck reqs', value: (data.stuck_requirements || []).length },
      { label: 'Stuck subs', value: (data.stuck_submissions || []).length },
      { label: 'Past SLA', value: (data.past_sla_requirements || []).length },
    ];
  }
  if (!Array.isArray(data) || data.length === 0) return [];

  if (reportKey === 'bda-performance') {
    return data.map((r) => ({
      label: r.bda?.name || 'BDA',
      leads: r.leads_created || 0,
      meeting: r.leads_in_meeting || 0,
      converted: r.leads_converted_active || 0,
      stuck: r.stuck_leads_current || 0,
    }));
  }
  if (reportKey === 'recruiter-performance') {
    return data.map((r) => ({
      label: r.recruiter?.name || 'Recruiter',
      sourced: r.profiles_sourced || 0,
      submissions: r.submissions_total || 0,
      closed: r.submissions_closed || 0,
      interviews: r.interviews_total || 0,
    }));
  }
  if (reportKey === 'sales-performance') {
    return data.map((r) => ({
      label: r.sales_person?.name || 'Sales',
      requirements: r.requirements_opened || 0,
      closed: r.requirements_closed || 0,
      closures: r.closures_count || 0,
      margin: Number(r.total_margin_generated || 0),
    }));
  }
  if (reportKey === 'vendor-performance') {
    return data.map((r) => ({
      label: r.vendor?.name || 'Vendor',
      submitted: r.profiles_submitted || 0,
      interviewed: r.profiles_interviewed || 0,
      closed: r.profiles_closed || 0,
      margin: Number(r.total_margin || 0),
    }));
  }
  if (reportKey === 'closure') {
    return data.map((r) => ({
      label: r.group_label || 'Group',
      closures: r.closures_count || 0,
      revenue: Number(r.total_revenue || 0),
      margin: Number(r.total_margin || 0),
    }));
  }
  if (reportKey === 'client-performance') {
    return data.map((r) => ({
      label: r.client?.name || 'Client',
      requirements: r.requirements_total || 0,
      closed: r.requirements_closed || 0,
      revenue: Number(r.total_revenue || 0),
    }));
  }
  return [];
}

export function chartTypeForReport(reportKey) {
  if (reportKey === 'aging' || reportKey === 'pipeline-explorer') return 'pie';
  if (reportKey === 'closure') return 'line';
  return 'bar';
}

export function chartBarsForReport(reportKey) {
  if (reportKey === 'aging' || reportKey === 'pipeline-explorer') {
    return [{ dataKey: 'value', name: 'Count', fill: '#3763f4' }];
  }
  if (reportKey === 'bda-performance') {
    return [
      { dataKey: 'leads', name: 'Leads', fill: '#3763f4' },
      { dataKey: 'meeting', name: 'In meeting', fill: '#0ea5e9' },
      { dataKey: 'converted', name: 'Converted', fill: '#16a34a' },
      { dataKey: 'stuck', name: 'Stuck 7d+', fill: '#d97706' },
    ];
  }
  if (reportKey === 'recruiter-performance') {
    return [
      { dataKey: 'sourced', name: 'Sourced', fill: '#3763f4' },
      { dataKey: 'submissions', name: 'Subs', fill: '#5a87fa' },
      { dataKey: 'closed', name: 'Closed', fill: '#16a34a' },
      { dataKey: 'interviews', name: 'Interviews', fill: '#d97706' },
    ];
  }
  if (reportKey === 'sales-performance') {
    return [
      { dataKey: 'requirements', name: 'Reqs opened', fill: '#3763f4' },
      { dataKey: 'closed', name: 'Req closed', fill: '#5a87fa' },
      { dataKey: 'closures', name: 'Joinings', fill: '#16a34a' },
    ];
  }
  if (reportKey === 'vendor-performance') {
    return [
      { dataKey: 'submitted', name: 'Submitted', fill: '#3763f4' },
      { dataKey: 'interviewed', name: 'Interviewed', fill: '#5a87fa' },
      { dataKey: 'closed', name: 'Closed', fill: '#16a34a' },
    ];
  }
  if (reportKey === 'closure') {
    return [
      { dataKey: 'closures', name: 'Closures', fill: '#3763f4' },
      { dataKey: 'margin', name: 'Margin', fill: '#16a34a' },
    ];
  }
  if (reportKey === 'client-performance') {
    return [
      { dataKey: 'requirements', name: 'Reqs', fill: '#3763f4' },
      { dataKey: 'closed', name: 'Closed', fill: '#16a34a' },
      { dataKey: 'revenue', name: 'Revenue', fill: '#d97706' },
    ];
  }
  return [];
}
