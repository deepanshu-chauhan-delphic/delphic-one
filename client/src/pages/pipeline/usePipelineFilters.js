/**
 * Encode and decode shared pipeline filter state from URL search params.
 */

const FILTER_KEYS = [
  'search',
  'account_id',
  'bda_id',
  'sales_id',
  'recruiter_id',
  'status',
  'priority',
  'submission_stage',
  'stuck_only',
  'past_sla_only',
  'date_from',
  'date_to',
];

export function emptyPipelineFilters() {
  return {
    search: '',
    account_id: '',
    bda_id: '',
    sales_id: '',
    recruiter_id: '',
    status: [],
    priority: [],
    submission_stage: [],
    stuck_only: false,
    past_sla_only: false,
    date_from: '',
    date_to: '',
  };
}

export function filtersFromSearchParams(searchParams) {
  const next = emptyPipelineFilters();
  next.search = searchParams.get('search') || '';
  next.account_id = searchParams.get('account_id') || '';
  next.bda_id = searchParams.get('bda_id') || '';
  next.sales_id = searchParams.get('sales_id') || '';
  next.recruiter_id = searchParams.get('recruiter_id') || '';
  next.status = csvToList(searchParams.get('status'));
  next.priority = csvToList(searchParams.get('priority'));
  next.submission_stage = csvToList(searchParams.get('submission_stage'));
  next.stuck_only = searchParams.get('stuck_only') === 'true';
  next.past_sla_only = searchParams.get('past_sla_only') === 'true';
  next.date_from = searchParams.get('date_from') || '';
  next.date_to = searchParams.get('date_to') || '';
  return next;
}

export function applyFiltersToSearchParams(searchParams, filters) {
  const next = new URLSearchParams(searchParams);
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (Array.isArray(value)) {
      if (value.length) next.set(key, value.join(','));
      else next.delete(key);
      continue;
    }
    if (typeof value === 'boolean') {
      if (value) next.set(key, 'true');
      else next.delete(key);
      continue;
    }
    if (value) next.set(key, String(value));
    else next.delete(key);
  }
  return next;
}

export function filtersToApiParams(filters, fields = null) {
  const allowed = fields ? new Set(fields) : null;
  const params = {};
  const include = (key) => !allowed || allowed.has(key);

  if (include('search') && filters.search?.trim()) params.search = filters.search.trim();
  if (include('account_id') && filters.account_id) params.account_id = filters.account_id;
  if (include('bda_id') && filters.bda_id) params.bda_id = filters.bda_id;
  if (include('sales_id') && filters.sales_id) params.sales_id = filters.sales_id;
  if (include('recruiter_id') && filters.recruiter_id) params.recruiter_id = filters.recruiter_id;
  if (include('status') && filters.status?.length) params.status = filters.status.join(',');
  if (include('priority') && filters.priority?.length) params.priority = filters.priority.join(',');
  if (include('submission_stage') && filters.submission_stage?.length) {
    params.submission_stage = filters.submission_stage.join(',');
  }
  if (include('stuck_only') && filters.stuck_only) params.stuck_only = 'true';
  if (include('past_sla_only') && filters.past_sla_only) params.past_sla_only = 'true';
  if (include('date_from') && filters.date_from) params.date_from = filters.date_from;
  if (include('date_to') && filters.date_to) params.date_to = filters.date_to;
  return params;
}

function csvToList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
