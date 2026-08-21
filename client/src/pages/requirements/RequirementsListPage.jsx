import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateRequirement } from '../../lib/requirementStages.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import { canAssignRecruiters } from '../profiles/profileUtils.js';
import AssignRecruiterModal from './AssignRecruiterModal.jsx';

function reqKey(id) {
  return `REQ-${String(id).slice(0, 8).toUpperCase()}`;
}

function RequirementPeek({ row, onClose, onAssign }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(row);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/requirements/${row.id}`)
      .then(({ data }) => setDetail(data.data || row))
      .catch(() => setDetail(row))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-tertiary-400">Loading details…</p>}
      <dl className="grid gap-4 sm:grid-cols-2">
        <PeekField label="Key">{reqKey(detail.id)}</PeekField>
        <PeekField label="Title">{detail.title}</PeekField>
        <PeekField label="Client">{detail.account?.name || '—'}</PeekField>
        <PeekField label="Status"><Badge value={detail.status} /></PeekField>
        <PeekField label="Priority"><Badge value={detail.priority} /></PeekField>
        <PeekField label="Type"><span className="capitalize">{detail.req_type || '—'}</span></PeekField>
        <PeekField label="Seats">{`${detail.seats_closed ?? 0}/${detail.seats_total ?? 0}`}</PeekField>
        <PeekField label="Sales owner">{detail.sales_owner?.name || '—'}</PeekField>
        <div className="sm:col-span-2">
          <PeekField label="Tech stack">
            <div className="mt-1 flex flex-wrap gap-1">
              {(detail.primary_tech_stack || []).length
                ? (detail.primary_tech_stack || []).map((t) => (
                    <span key={t} className="rounded-full bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">
                      {t}
                    </span>
                  ))
                : '—'}
            </div>
          </PeekField>
        </div>
      </dl>
      <PeekActions>
        <button type="button" className="btn-primary" onClick={() => navigate(`/requirements/${detail.id}/board`)}>
          Open board
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            onAssign(detail);
            onClose();
          }}
        >
          {canAssignRecruiters(user) ? 'Assign recruiters' : 'View assignments'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate(`/requirements/${detail.id}/edit`)}>
          Edit
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </PeekActions>
    </div>
  );
}

export default function RequirementsListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [peek, setPeek] = useState(null);
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [accounts, setAccounts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    account_id: '',
    title: '',
    req_type: 'developer',
    priority: 'medium',
    primary_tech_stack: '',
    seats_total: '1',
  });

  function reload() {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (appliedSearch) params.search = appliedSearch;
    apiClient
      .get('/requirements', { params })
      .then(({ data }) => setRows(data.data || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, priority, status]);

  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!createOpen) return undefined;
    apiClient
      .get('/accounts', { params: { type: 'client', limit: 100 } })
      .then(({ data }) => setAccounts(data.data || []))
      .catch(() => setAccounts([]));
    return undefined;
  }, [createOpen]);

  function closeCreate() {
    setCreateOpen(false);
    setCreateError('');
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }

  async function createRequirement(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const body = {
        account_id: form.account_id,
        title: form.title.trim(),
        req_type: form.req_type,
        priority: form.priority,
        primary_tech_stack: form.primary_tech_stack
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        seats_total: Number(form.seats_total) || 1,
      };
      const { data } = await apiClient.post('/requirements', body);
      closeCreate();
      reload();
      setPeek(data.data);
    } catch (err) {
      setCreateError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'work',
        header: 'Work',
        render: (row) => (
          <div>
            <div className="font-mono text-xs text-primary-700">{reqKey(row.id)}</div>
            <div className="font-medium text-tertiary-900">{row.title}</div>
          </div>
        ),
      },
      { key: 'client', header: 'Client', render: (row) => row.account?.name || '—' },
      { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
      { key: 'priority', header: 'Priority', render: (row) => <Badge value={row.priority} /> },
      { key: 'seats', header: 'Seats', render: (row) => `${row.seats_closed}/${row.seats_total}` },
      {
        key: 'tech',
        header: 'Tech',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {(row.primary_tech_stack || []).slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">
                {t}
              </span>
            ))}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">Requirements</h1>
          <p className="mt-1 text-sm text-tertiary-500">Open jobs, seats, and recruiter assignments.</p>
        </div>
        {canCreateRequirement(user) && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            + Create
          </button>
        )}
      </div>

      <ListToolbar>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search.trim());
          }}
          className="flex"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or client"
            className="w-56 rounded-l-xl border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r-xl border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border bg-white px-2 py-1.5 text-sm">
          <option value="">Status: All</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
          <option value="dropped">Dropped</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl border bg-white px-2 py-1.5 text-sm">
          <option value="">Priority: All</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </ListToolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No records found" onRowClick={setPeek} />
      <div className="px-1 text-xs text-tertiary-500">
        {rows.length} of {rows.length}
      </div>

      {assignTarget && <AssignRecruiterModal requirement={assignTarget} onClose={() => setAssignTarget(null)} />}

      <Drawer open={Boolean(peek)} title={peek?.title || 'Requirement'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && (
          <RequirementPeek
            row={peek}
            onClose={() => setPeek(null)}
            onAssign={setAssignTarget}
          />
        )}
      </Drawer>

      <Drawer open={createOpen} title="Create requirement" onClose={closeCreate} size="md" tone="create">
        <form onSubmit={createRequirement} className="space-y-3">
          {createError && (
            <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{createError}</div>
          )}
          <label className="block text-xs font-medium text-tertiary-500">
            Client *
            <select
              required
              value={form.account_id}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">Select client…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Title *
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Type *
            <select
              value={form.req_type}
              onChange={(e) => setForm((f) => ({ ...f, req_type: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="developer">Developer</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Priority
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Primary tech (comma separated)
            <input
              value={form.primary_tech_stack}
              onChange={(e) => setForm((f) => ({ ...f, primary_tech_stack: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Seats
            <input
              type="number"
              min={1}
              value={form.seats_total}
              onChange={(e) => setForm((f) => ({ ...f, seats_total: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeCreate}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
