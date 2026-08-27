import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, MoreVertical } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateSubmission } from '../../lib/submissionStages.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import { PeekActions, PeekField } from '../../components/ui/PeekFields.jsx';
import SubmissionCreatePage from './SubmissionCreatePage.jsx';

function subKey(id) {
  return `SUB-${String(id).slice(0, 8).toUpperCase()}`;
}

function SubmissionPeek({ row, onClose }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(row);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/submissions/${row.id}`)
      .then(({ data }) => setDetail(data.data || row))
      .catch(() => setDetail(row))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-tertiary-400">Loading details…</p>}
      <dl className="grid gap-4 sm:grid-cols-2">
        <PeekField label="Key">{subKey(detail.id)}</PeekField>
        <PeekField label="Candidate">{detail.profile?.name || '—'}</PeekField>
        <PeekField label="Job">{detail.requirement?.title || '—'}</PeekField>
        <PeekField label="Stage"><Badge value={detail.stage} /></PeekField>
        <PeekField label="Proposed rate">
          {detail.proposed_rate ? `${detail.proposed_rate_currency} ${detail.proposed_rate}` : '—'}
        </PeekField>
        <PeekField label="Margin">{detail.margin != null ? detail.margin : '—'}</PeekField>
        <PeekField label="Recruiter">{detail.submitted_by?.name || '—'}</PeekField>
        <PeekField label="Relevancy">{detail.relevancy_score ?? '—'}</PeekField>
      </dl>
      {detail.submission_notes && (
        <PeekField label="Notes">{detail.submission_notes}</PeekField>
      )}
      <PeekActions>
        <button type="button" className="btn-primary" onClick={() => navigate(`/submissions/${detail.id}`)}>
          Manage interviews
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </PeekActions>
      <p className="text-xs text-tertiary-400">
        Stage changes and interview rounds stay on the submission workspace when you need the full timeline.
      </p>
    </div>
  );
}

export default function SubmissionsListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(() => searchParams.get('stage') || '');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [peek, setPeek] = useState(null);

  function reload() {
    setLoading(true);
    const params = {};
    if (stage) params.stage = stage;
    if (appliedSearch) params.search = appliedSearch;
    apiClient
      .get('/submissions', { params })
      .then(({ data }) => setRows(data.data || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, stage]);

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

  const columns = useMemo(
    () => [
      {
        key: 'work',
        header: 'Work',
        render: (row) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-primary-600">{subKey(row.id)}</div>
            <div className="font-semibold text-tertiary-900">{row.profile?.name || '—'}</div>
          </div>
        ),
      },
      { key: 'job', header: 'Job', render: (row) => row.requirement?.title || '—' },
      { key: 'stage', header: 'Stage', render: (row) => <Badge value={row.stage} /> },
      {
        key: 'rate',
        header: 'Rate',
        render: (row) => (row.proposed_rate ? `${row.proposed_rate_currency} ${row.proposed_rate}` : '—'),
      },
      { key: 'margin', header: 'Margin', render: (row) => (row.margin != null ? row.margin : '—') },
      { key: 'recruiter', header: 'Recruiter', render: (row) => row.submitted_by?.name || '—' },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <button
            type="button"
            className="rounded-lg p-1.5 text-tertiary-400 transition-colors hover:bg-tertiary-50 hover:text-tertiary-700"
            aria-label={`Actions for ${row.profile?.name || 'submission'}`}
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
      {canCreateSubmission(user) && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
            + Put forward
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
                  placeholder="Search candidate or job"
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
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="rounded-lg border border-tertiary-100 bg-white px-3 py-1.5 text-sm text-tertiary-700 shadow-soft"
            >
              <option value="">Stage: All</option>
              {[
                'sourced',
                'internal_screening',
                'submitted_to_client',
                'interview_scheduled',
                'interview_result',
                'offer_sent',
                'bgv',
                'closed',
                'backout',
                'rejected',
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyLabel="No submissions match these filters."
          onRowClick={setPeek}
          headerClassName="bg-[#F9FAFB]"
          striped
          embedded
        />
      </section>

      <div className="px-1 text-xs text-tertiary-500">
        {rows.length} of {rows.length}
      </div>

      <Drawer open={Boolean(peek)} title={peek?.profile?.name || 'Submission'} onClose={() => setPeek(null)} size="md" tone="info">
        {peek && <SubmissionPeek row={peek} onClose={() => setPeek(null)} />}
      </Drawer>

      <Drawer open={createOpen} title="Put a candidate forward" onClose={closeCreate} size="md" tone="create">
        <SubmissionCreatePage
          asPanel
          onCancel={closeCreate}
          onDone={(id) => {
            closeCreate();
            reload();
            setPeek({ id, profile: { name: 'Submission' } });
          }}
        />
      </Drawer>
    </div>
  );
}
