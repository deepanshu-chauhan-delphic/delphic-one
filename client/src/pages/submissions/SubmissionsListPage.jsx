import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateSubmission } from '../../lib/submissionStages.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import ListToolbar from '../../components/ui/ListToolbar.jsx';
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
  const [stage, setStage] = useState('');
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
          <div>
            <div className="font-mono text-xs text-primary-700">{subKey(row.id)}</div>
            <div className="font-medium text-tertiary-900">{row.profile?.name || '—'}</div>
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
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">Submissions</h1>
          <p className="mt-1 text-sm text-tertiary-500">Candidates put forward for jobs, by pipeline stage.</p>
        </div>
        {canCreateSubmission(user) && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            + Put forward
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
            placeholder="Search candidate or job"
            className="w-56 rounded-l-xl border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r-xl border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="rounded-xl border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Stage: All</option>
          {[
            'sourced',
            'internal_screening',
            'submitted_to_client',
            'interview_scheduled',
            'interview_result',
            'offer',
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
      </ListToolbar>

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No records found" onRowClick={setPeek} />
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
