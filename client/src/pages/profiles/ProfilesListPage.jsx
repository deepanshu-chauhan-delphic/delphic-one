import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import ProfileFormPage from './ProfileFormPage.jsx';
import { apiErrorMessage, canCreateProfile, canEditProfile, profileKey } from './profileUtils.js';

function ProfilePeek({ row, onClose, onChanged }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(row);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/profiles/${row.id}`)
      .then(({ data }) => setDetail(data.data || row))
      .catch(() => setDetail(row))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-tertiary-400">Loading details…</p>}
      <dl className="grid gap-4 sm:grid-cols-2">
        <PeekField label="Key">{profileKey(detail.id)}</PeekField>
        <PeekField label="Name">{detail.name}</PeekField>
        <PeekField label="Company">{detail.current_company || '—'}</PeekField>
        <PeekField label="Experience">{detail.total_experience_years ?? '—'}</PeekField>
        <PeekField label="Source"><Badge value={detail.source} /></PeekField>
        <PeekField label="Expected CTC">
          {detail.expected_ctc != null ? `${detail.expected_ctc_currency} ${detail.expected_ctc}` : '—'}
        </PeekField>
        <PeekField label="Email">{detail.email || '—'}</PeekField>
        <PeekField label="Phone">{detail.phone || '—'}</PeekField>
        <div className="sm:col-span-2">
          <PeekField label="Primary skills">
            <div className="mt-1 flex flex-wrap gap-1">
              {(detail.primary_skills || []).length
                ? (detail.primary_skills || []).map((skill) => (
                    <span key={skill} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                      {skill}
                    </span>
                  ))
                : '—'}
            </div>
          </PeekField>
        </div>
      </dl>
      <PeekActions>
        {canEditProfile(user) && (
          <button type="button" className="btn-primary" onClick={() => navigate(`/profiles/${detail.id}/edit`)}>
            Edit candidate
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            navigate('/submissions?create=1');
          }}
        >
          Put forward
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </PeekActions>
    </div>
  );
}

export default function ProfilesListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [peek, setPeek] = useState(null);

  function reload() {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (appliedSearch) params.search = appliedSearch;
    if (source) params.source = source;
    apiClient
      .get('/profiles', { params })
      .then(({ data }) => {
        setRows(data.data || []);
        setPagination(data.pagination || { page, total: data.data?.length || 0, totalPages: 1 });
      })
      .catch((requestError) => setError(apiErrorMessage(requestError, 'Failed to load profiles')))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, page, source]);

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
        key: 'candidate',
        header: 'Candidate',
        render: (row) => (
          <div>
            <div className="font-medium text-primary-700">{profileKey(row.id)}</div>
            <span className="text-tertiary-900">{row.name}</span>
          </div>
        ),
      },
      { key: 'company', header: 'Company', render: (row) => row.current_company || '—' },
      { key: 'exp', header: 'Exp', render: (row) => row.total_experience_years },
      {
        key: 'skills',
        header: 'Skills',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {(row.primary_skills || []).slice(0, 3).map((skill) => (
              <span key={skill} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                {skill}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'ctc',
        header: 'Expected CTC',
        render: (row) => (row.expected_ctc != null ? `${row.expected_ctc_currency} ${row.expected_ctc}` : '—'),
      },
      { key: 'source', header: 'Source', render: (row) => <Badge value={row.source} /> },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">Candidates</h1>
          <p className="mt-1 text-sm text-tertiary-500">Profiles with skills, CTC, and resume attachments.</p>
        </div>
        {canCreateProfile(user) && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            + Add candidate
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
            placeholder="Search name, company, skills…"
            className="w-64 rounded-l-xl border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r-xl border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={source}
          onChange={(event) => {
            setPage(1);
            setSource(event.target.value);
          }}
          className="rounded-xl border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Source: All</option>
          <option value="internal">Internal</option>
          <option value="vendor">Vendor</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </ListToolbar>

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyLabel="No candidates match these filters."
        onRowClick={setPeek}
      />
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

      <Drawer open={Boolean(peek)} title={peek?.name || 'Candidate'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && <ProfilePeek row={peek} onClose={() => setPeek(null)} onChanged={reload} />}
      </Drawer>

      <Drawer open={createOpen} title="Add candidate" onClose={closeCreate} size="md" tone="create">
        <ProfileFormPage
          asPanel
          onCancel={closeCreate}
          onDone={(id) => {
            closeCreate();
            reload();
            setPeek({ id, name: 'Candidate' });
          }}
        />
      </Drawer>
    </div>
  );
}
