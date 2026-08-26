import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateRequirement } from '../../lib/requirementStages.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import { canAssignRecruiters } from '../profiles/profileUtils.js';
import AssignRecruiterDrawer from './AssignRecruiterDrawer.jsx';
import RequirementFormPage from './RequirementFormPage.jsx';

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
        <button type="button" className="btn-secondary" onClick={() => navigate(`/requirements/${detail.id}?edit=1`)}>
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

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'work',
        header: 'Work',
        render: (row) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-primary-600">{reqKey(row.id)}</div>
            <div className="font-semibold text-tertiary-900">{row.title}</div>
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
              <span key={t} className="rounded-full bg-canvas-muted px-2 py-0.5 text-xs text-tertiary-600">
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
    <div className="space-y-2">
      {canCreateRequirement(user) && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
            + Create
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-tertiary-100 bg-white shadow-card">
        <div className="border-b border-tertiary-100 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-tertiary-100 bg-canvas-muted px-3 py-1.5 text-xs font-medium text-tertiary-700">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </span>
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
                  className="w-56 rounded-l-lg border border-tertiary-100 bg-canvas-muted px-3 py-1.5 text-sm text-tertiary-800 placeholder:text-tertiary-400 focus:border-primary-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <button
                  type="submit"
                  className="rounded-r-lg border border-l-0 border-tertiary-100 bg-[#EEF4FF] px-3 py-1.5 text-xs font-semibold text-[#0052FF] transition-colors hover:bg-[#DBE6FE]"
                >
                  Search
                </button>
              </form>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
              >
                <option value="">Status: All</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="on_hold">On hold</option>
                <option value="closed">Closed</option>
                <option value="dropped">Dropped</option>
              </select>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
              >
                <option value="">Priority: All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyLabel="No requirements match these filters."
          onRowClick={setPeek}
          headerClassName="bg-[#F9FAFB]"
          striped
          embedded
        />
      </section>

      <div className="px-1 text-xs text-tertiary-500">
        {rows.length} of {rows.length}
      </div>

      {assignTarget && <AssignRecruiterDrawer requirement={assignTarget} onClose={() => setAssignTarget(null)} />}

      <Drawer open={Boolean(peek)} title={peek?.title || 'Requirement'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && (
          <RequirementPeek
            row={peek}
            onClose={() => setPeek(null)}
            onAssign={setAssignTarget}
          />
        )}
      </Drawer>

      <Drawer open={createOpen} title="Create requirement" onClose={closeCreate} size="lg" tone="create">
        {createOpen && (
          <RequirementFormPage
            asPanel
            onCancel={closeCreate}
            onDone={(newId) => {
              closeCreate();
              reload();
              if (newId) setPeek({ id: newId, title: 'Requirement' });
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
