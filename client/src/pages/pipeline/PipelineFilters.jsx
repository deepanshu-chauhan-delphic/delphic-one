import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown.jsx';
import {
  applyFiltersToSearchParams,
  emptyPipelineFilters,
  filtersFromSearchParams,
  filtersToApiParams,
} from './usePipelineFilters.js';

const STATUS_OPTIONS = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'closed', label: 'Closed' },
  { id: 'dropped', label: 'Dropped' },
];

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

const STAGE_OPTIONS = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'internal_screening', label: 'Internal screening' },
  { id: 'submitted_to_client', label: 'Submitted to client' },
  { id: 'interview_scheduled', label: 'Interview scheduled' },
  { id: 'interview_result', label: 'Interview result' },
  { id: 'offer_sent', label: 'Offer sent' },
  { id: 'bgv', label: 'BGV' },
  { id: 'closed', label: 'Closed' },
  { id: 'backout', label: 'Backout' },
  { id: 'rejected', label: 'Rejected' },
];

/**
 * Shared pipeline filter bar. Controlled through URL search params.
 *
 * Args:
 *   fields: string[] of filter keys to show for the current board.
 *   onChange: optional callback receiving API params when filters change.
 */
export default function PipelineFilters({
  fields = ['search', 'stuck_only', 'past_sla_only', 'status', 'sales_id', 'bda_id', 'recruiter_id', 'account_id'],
  onChange,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [draftSearch, setDraftSearch] = useState(filters.search);
  const [accounts, setAccounts] = useState([]);
  const [bdas, setBdas] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const lastApiParamsKey = useRef('');

  // Content key so inline fields={[...]} from parents does not retrigger fetches every render.
  const fieldsKey = Array.isArray(fields) ? fields.join(',') : '';
  const fieldList = useMemo(() => (fieldsKey ? fieldsKey.split(',') : []), [fieldsKey]);
  const fieldSet = useMemo(() => new Set(fieldList), [fieldList]);
  const apiParams = useMemo(() => filtersToApiParams(filters, fieldList), [filters, fieldList]);

  useEffect(() => {
    setDraftSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const key = JSON.stringify(apiParams);
    if (key === lastApiParamsKey.current) return;
    lastApiParamsKey.current = key;
    onChange?.(apiParams);
  }, [apiParams, onChange]);

  useEffect(() => {
    let cancelled = false;
    if (fieldSet.has('account_id')) {
      apiClient
        .get('/accounts', { params: { type: 'client', limit: 100, sort_by: 'name', sort_order: 'asc' } })
        .then(({ data }) => {
          if (!cancelled) setAccounts((data.data || []).map((row) => ({ id: row.id, label: row.name })));
        })
        .catch(() => {
          if (!cancelled) setAccounts([]);
        });
    }
    if (fieldSet.has('bda_id')) {
      apiClient
        .get('/users', { params: { role: 'bda', active: true, limit: 100 } })
        .then(({ data }) => {
          if (!cancelled) setBdas((data.data || []).map((row) => ({ id: row.id, label: row.name })));
        })
        .catch(() => {
          if (!cancelled) setBdas([]);
        });
    }
    if (fieldSet.has('sales_id')) {
      apiClient
        .get('/users', { params: { role: 'sales', active: true, limit: 100 } })
        .then(({ data }) => {
          if (!cancelled) setSalesUsers((data.data || []).map((row) => ({ id: row.id, label: row.name })));
        })
        .catch(() => {
          if (!cancelled) setSalesUsers([]);
        });
    }
    if (fieldSet.has('recruiter_id')) {
      apiClient
        .get('/users', { params: { role: 'recruiter', active: true, limit: 100 } })
        .then(({ data }) => {
          if (!cancelled) setRecruiters((data.data || []).map((row) => ({ id: row.id, label: row.name })));
        })
        .catch(() => {
          if (!cancelled) setRecruiters([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [fieldsKey, fieldSet]);

  function patchFilters(patch) {
    const nextFilters = { ...filters, ...patch };
    setSearchParams(applyFiltersToSearchParams(searchParams, nextFilters), { replace: true });
  }

  function clearFilters() {
    setDraftSearch('');
    setSearchParams(applyFiltersToSearchParams(searchParams, emptyPipelineFilters()), { replace: true });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tertiary-100 bg-canvas-muted px-3 py-1.5 text-xs font-medium text-tertiary-700">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </span>

      {fieldSet.has('search') && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            patchFilters({ search: draftSearch.trim() });
          }}
          className="flex"
        >
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search…"
            className="w-56 rounded-l-lg border border-tertiary-100 bg-canvas-muted px-3 py-1.5 text-sm text-tertiary-800 placeholder:text-tertiary-400 focus:border-primary-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="submit"
            className="rounded-r-lg border border-l-0 border-tertiary-100 bg-[#EEF4FF] px-3 py-1.5 text-xs font-semibold text-[#0052FF] transition-colors hover:bg-[#DBE6FE]"
          >
            Search
          </button>
        </form>
      )}

      {fieldSet.has('account_id') && (
        <select
          value={filters.account_id}
          onChange={(event) => patchFilters({ account_id: event.target.value })}
          className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
          aria-label="Client"
        >
          <option value="">All clients</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      )}

      {fieldSet.has('bda_id') && (
        <select
          value={filters.bda_id}
          onChange={(event) => patchFilters({ bda_id: event.target.value })}
          className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
          aria-label="BDA"
        >
          <option value="">All BDAs</option>
          {bdas.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      )}

      {fieldSet.has('sales_id') && (
        <select
          value={filters.sales_id}
          onChange={(event) => patchFilters({ sales_id: event.target.value })}
          className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
          aria-label="Sales"
        >
          <option value="">All sales</option>
          {salesUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      )}

      {fieldSet.has('recruiter_id') && (
        <select
          value={filters.recruiter_id}
          onChange={(event) => patchFilters({ recruiter_id: event.target.value })}
          className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
          aria-label="Recruiter"
        >
          <option value="">All recruiters</option>
          {recruiters.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </select>
      )}

      {fieldSet.has('status') && (
        <div className="min-w-[180px]">
          <MultiSelectDropdown
            value={filters.status}
            onChange={(status) => patchFilters({ status })}
            options={STATUS_OPTIONS}
            placeholder="Statuses…"
            searchPlaceholder="Search status…"
          />
        </div>
      )}

      {fieldSet.has('priority') && (
        <div className="min-w-[160px]">
          <MultiSelectDropdown
            value={filters.priority}
            onChange={(priority) => patchFilters({ priority })}
            options={PRIORITY_OPTIONS}
            placeholder="Priority…"
            searchPlaceholder="Search priority…"
          />
        </div>
      )}

      {fieldSet.has('submission_stage') && (
        <div className="min-w-[200px]">
          <MultiSelectDropdown
            value={filters.submission_stage}
            onChange={(submission_stage) => patchFilters({ submission_stage })}
            options={STAGE_OPTIONS}
            placeholder="Candidate stages…"
            searchPlaceholder="Search stage…"
          />
        </div>
      )}

      {fieldSet.has('stuck_only') && (
        <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft">
          <input
            type="checkbox"
            checked={filters.stuck_only}
            onChange={(event) => patchFilters({ stuck_only: event.target.checked })}
          />
          Stuck only
        </label>
      )}

      {fieldSet.has('stuck') && (
        <select
          value={filters.stuck}
          onChange={(event) => patchFilters({ stuck: event.target.value })}
          className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
          aria-label="Stuck"
        >
          <option value="all">Stuck: All</option>
          <option value="stuck">Stuck only</option>
          <option value="not_stuck">Not stuck</option>
        </select>
      )}

      {fieldSet.has('past_sla_only') && (
        <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft">
          <input
            type="checkbox"
            checked={filters.past_sla_only}
            onChange={(event) => patchFilters({ past_sla_only: event.target.checked })}
          />
          Past SLA
        </label>
      )}

      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={clearFilters}>
        Clear
      </button>
    </div>
  );
}
