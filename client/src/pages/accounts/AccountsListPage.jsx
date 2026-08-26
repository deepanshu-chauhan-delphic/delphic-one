import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, MoreVertical } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import { accountAccent } from '../../lib/accountAccent.js';
import AccountFormPage from './AccountFormPage.jsx';
import AccountStageMoveDrawer from './AccountStageMoveDrawer.jsx';
import {
  ACCOUNT_TRANSITIONS,
  accountKey,
  apiErrorMessage,
  canCreateAccount,
  canMutateAccount,
} from './accountUtils.js';

function AccountPeek({ row, onClose, onChanged, onRequestStageMove }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(row);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/accounts/${row.id}`)
      .then(({ data }) => setDetail(data.data || row))
      .catch(() => setDetail(row))
      .finally(() => setLoading(false));
  }, [row]);

  const canEdit = canMutateAccount(detail, user) && !detail.is_locked;
  const nextStages = ACCOUNT_TRANSITIONS[detail.stage] || [];

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
        <button type="button" className="btn-secondary" onClick={() => navigate(`/accounts/${detail.id}`)}>
          Open details
        </button>
        {canEdit && (
          <button type="button" className="btn-secondary" onClick={() => navigate(`/accounts/${detail.id}?edit=1`)}>
            Edit account
          </button>
        )}
        {canEdit && nextStages.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => onRequestStageMove(detail)}>
            Move stage
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState(() => searchParams.get('stage') || '');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [peek, setPeek] = useState(null);
  const [stageTarget, setStageTarget] = useState(null);
  const [stageError, setStageError] = useState('');
  const [movingStage, setMovingStage] = useState(false);

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
    setStage(searchParams.get('stage') || '');
  }, [searchParams]);

  function closeCreate() {
    setCreateOpen(false);
    if (searchParams.get('create')) {
      searchParams.delete('create');
      setSearchParams(searchParams, { replace: true });
    }
  }

  async function moveStage(body) {
    if (!stageTarget) return;
    setMovingStage(true);
    setStageError('');
    try {
      const { data } = await apiClient.post(`/accounts/${stageTarget.id}/stage`, body);
      setStageTarget(null);
      setPeek(data.data || stageTarget);
      reload();
    } catch (requestError) {
      setStageError(apiErrorMessage(requestError, 'Failed to move account stage'));
    } finally {
      setMovingStage(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'account',
        header: 'Account',
        render: (row) => (
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accountAccent(row.id).dot}`}
              aria-hidden="true"
              title="Account color"
            />
            <div className="min-w-0 leading-snug">
              <div className="text-sm font-medium text-primary-600">{accountKey(row.id)}</div>
              <div className="font-semibold text-tertiary-900">{row.name}</div>
              {row.poc_name && <div className="text-xs text-tertiary-500">{row.poc_name}</div>}
            </div>
          </div>
        ),
      },
      { key: 'type', header: 'Type', render: (row) => <span className="capitalize text-tertiary-700">{row.type}</span> },
      { key: 'industry', header: 'Industry', render: (row) => row.industry || '—' },
      { key: 'stage', header: 'Stage', render: (row) => <Badge value={row.stage} /> },
      { key: 'owner', header: 'Owner', render: (row) => row.owner?.name || '—' },
      {
        key: 'created',
        header: 'Created',
        render: (row) => new Date(row.created_at).toLocaleDateString(),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <button
            type="button"
            className="rounded-lg p-1.5 text-tertiary-400 transition-colors hover:bg-tertiary-50 hover:text-tertiary-700"
            aria-label={`Actions for ${row.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setPeek(row);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-2">
      {canCreateAccount(user) && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
            + Create account
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
                  setPage(1);
                  setAppliedSearch(search.trim());
                }}
                className="flex"
              >
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or contact"
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
                value={type}
                onChange={(event) => {
                  setPage(1);
                  setType(event.target.value);
                }}
                className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
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
                className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
              >
                <option value="">Stage: All</option>
                <option value="lead">Lead</option>
                <option value="meeting_scheduled">Meeting scheduled</option>
                <option value="active">Active</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyLabel="No accounts match these filters."
          onRowClick={setPeek}
          headerClassName="bg-[#F9FAFB]"
          striped
          embedded
        />
      </section>

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
      <div className="flex items-center justify-between px-1 text-xs text-tertiary-500">
        <span>
          {rows.length} of {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((c) => c - 1)}
            className="rounded-lg border border-tertiary-100 bg-white px-2.5 py-1 shadow-soft disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((c) => c + 1)}
            className="rounded-lg border border-tertiary-100 bg-white px-2.5 py-1 shadow-soft disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <Drawer open={Boolean(peek)} title={peek?.name || 'Account'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && (
          <AccountPeek
            row={peek}
            onClose={() => setPeek(null)}
            onChanged={reload}
            onRequestStageMove={(account) => {
              setStageError('');
              setStageTarget(account);
            }}
          />
        )}
      </Drawer>

      <AccountStageMoveDrawer
        account={stageTarget}
        open={Boolean(stageTarget)}
        error={stageError}
        saving={movingStage}
        onClose={() => {
          setStageError('');
          setStageTarget(null);
        }}
        onMove={moveStage}
      />

      <Drawer open={createOpen} title="Create client or vendor" onClose={closeCreate} size="lg" tone="create">
        {createOpen && (
          <AccountFormPage
            asPanel
            onCancel={closeCreate}
            onDone={(newId) => {
              closeCreate();
              reload();
              if (newId) setPeek({ id: newId, name: 'Account' });
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
