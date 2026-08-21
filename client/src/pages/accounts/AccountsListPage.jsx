import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import { accountKey, apiErrorMessage, canCreateAccount, canMutateAccount } from './accountUtils.js';

function AccountPeek({ row, onClose, onChanged }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(row);
  const [loading, setLoading] = useState(true);
  const canEdit = canMutateAccount(user);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/accounts/${row.id}`)
      .then(({ data }) => setDetail(data.data || row))
      .catch(() => setDetail(row))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-tertiary-400">Loading details…</p>}
      <dl className="grid gap-4 sm:grid-cols-2">
        <PeekField label="Key">{accountKey(detail.id)}</PeekField>
        <PeekField label="Name">{detail.name}</PeekField>
        <PeekField label="Type"><span className="capitalize">{detail.type}</span></PeekField>
        <PeekField label="Stage"><Badge value={detail.stage} /></PeekField>
        <PeekField label="Industry">{detail.industry || '—'}</PeekField>
        <PeekField label="Owner">{detail.owner?.name || '—'}</PeekField>
        <PeekField label="POC">{detail.poc_name || '—'}</PeekField>
        <PeekField label="POC email">{detail.poc_email || '—'}</PeekField>
        <PeekField label="City">{detail.location_city || '—'}</PeekField>
        <PeekField label="Created">
          {detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'}
        </PeekField>
      </dl>
      <PeekActions>
        {canEdit && (
          <button type="button" className="btn-primary" onClick={() => navigate(`/accounts/${detail.id}/edit`)}>
            Edit account
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            onClose();
            onChanged?.();
          }}
        >
          Close
        </button>
      </PeekActions>
    </div>
  );
}

export default function AccountsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [peek, setPeek] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    type: 'client',
    name: '',
    industry: '',
    poc_name: '',
    poc_email: '',
  });

  function reload() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (type) params.type = type;
    if (stage) params.stage = stage;
    if (appliedSearch) params.search = appliedSearch;
    apiClient
      .get('/accounts', { params })
      .then(({ data }) => {
        setRows(data.data || []);
        setPagination(data.pagination || { page, total: data.data?.length || 0, totalPages: 1 });
      })
      .catch((requestError) => setError(apiErrorMessage(requestError, 'Failed to load accounts')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, page, stage, type]);

  useEffect(() => {
    if (searchParams.get('create') === '1') setCreateOpen(true);
  }, [searchParams]);

  function closeCreate() {
    setCreateOpen(false);
    setCreateError('');
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }

  async function createAccount(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const body = {
        type: form.type,
        name: form.name.trim(),
        industry: form.industry.trim() || undefined,
        poc_name: form.poc_name.trim() || undefined,
        poc_email: form.poc_email.trim() || undefined,
      };
      const { data } = await apiClient.post('/accounts', body);
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
        key: 'account',
        header: 'Account',
        render: (row) => (
          <div>
            <div className="font-medium text-primary-700">{accountKey(row.id)}</div>
            <div className="text-tertiary-900">{row.name}</div>
            {row.poc_name && <div className="mt-0.5 text-xs text-tertiary-500">{row.poc_name}</div>}
          </div>
        ),
      },
      { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
      { key: 'industry', header: 'Industry', render: (row) => row.industry || '—' },
      { key: 'stage', header: 'Stage', render: (row) => <Badge value={row.stage} /> },
      { key: 'owner', header: 'Owner', render: (row) => row.owner?.name || '—' },
      {
        key: 'created',
        header: 'Created',
        render: (row) => new Date(row.created_at).toLocaleDateString(),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">Clients & vendors</h1>
          <p className="mt-1 text-sm text-tertiary-500">Track lead ownership, meetings, and account stage.</p>
        </div>
        {canCreateAccount(user) && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            + Create account
          </button>
        )}
      </div>

      <ListToolbar>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
          className="flex"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or contact"
            className="w-56 rounded-l-xl border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r-xl border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={type}
          onChange={(event) => {
            setPage(1);
            setType(event.target.value);
          }}
          className="rounded-xl border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Type: All</option>
          <option value="client">Client</option>
          <option value="vendor">Vendor</option>
        </select>
        <select
          value={stage}
          onChange={(event) => {
            setPage(1);
            setStage(event.target.value);
          }}
          className="rounded-xl border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Stage: All</option>
          <option value="lead">Lead</option>
          <option value="meeting_scheduled">Meeting scheduled</option>
          <option value="active">Active</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="dropped">Dropped</option>
        </select>
      </ListToolbar>

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No accounts match these filters." onRowClick={setPeek} />
      <div className="flex items-center justify-between px-1 text-xs text-tertiary-500">
        <span>
          {rows.length} of {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((c) => c - 1)} className="rounded-xl border bg-white px-2 py-1 disabled:opacity-40">
            Previous
          </button>
          <span>
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((c) => c + 1)}
            className="rounded-xl border bg-white px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <Drawer open={Boolean(peek)} title={peek?.name || 'Account'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && <AccountPeek row={peek} onClose={() => setPeek(null)} onChanged={reload} />}
      </Drawer>

      <Drawer open={createOpen} title="Create account" onClose={closeCreate} size="md" tone="create">
        <form onSubmit={createAccount} className="space-y-3">
          {createError && (
            <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{createError}</div>
          )}
          <label className="block text-xs font-medium text-tertiary-500">
            Type *
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Name *
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            Industry
            <input
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            POC name
            <input
              value={form.poc_name}
              onChange={(e) => setForm((f) => ({ ...f, poc_name: e.target.value }))}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-tertiary-500">
            POC email
            <input
              type="email"
              value={form.poc_email}
              onChange={(e) => setForm((f) => ({ ...f, poc_email: e.target.value }))}
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
