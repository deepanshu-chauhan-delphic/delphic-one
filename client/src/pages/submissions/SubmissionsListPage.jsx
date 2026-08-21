import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
<<<<<<< Updated upstream
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateSubmission } from '../../lib/submissionStages.js';
import DataTable from '../../components/ui/DataTable.jsx';
=======
import apiClient from '../../lib/apiClient';
>>>>>>> Stashed changes
import Badge from '../../components/ui/Badge.jsx';

function subKey(id) {
  return `SUB-${String(id).slice(0, 8).toUpperCase()}`;
}

export default function SubmissionsListPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (stage) params.stage = stage;
    if (appliedSearch) params.search = appliedSearch;
    apiClient
      .get('/submissions', { params })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [appliedSearch, stage]);

<<<<<<< Updated upstream
  const columns = [
    {
      key: 'profile',
      header: 'Candidate',
      render: (r) => (
        <Link to={`/submissions/${r.id}`} className="font-medium text-primary-700 hover:underline">
          {r.profile?.name || '—'}
        </Link>
      ),
    },
    { key: 'requirement', header: 'Requirement', render: (r) => r.requirement?.title || '—' },
    { key: 'stage', header: 'Stage', render: (r) => <Badge value={r.stage} /> },
    {
      key: 'proposed_rate',
      header: 'Proposed rate',
      render: (r) => (r.proposed_rate != null ? `${r.proposed_rate_currency || ''} ${r.proposed_rate}` : '—'),
    },
    {
      key: 'margin',
      header: 'Margin',
      render: (r) => (r.margin != null ? `${r.margin} (${r.margin_percentage}%)` : '—'),
    },
    { key: 'submitted_by', header: 'Recruiter', render: (r) => r.submitted_by?.name || '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Submissions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All stages</option>
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
          {canCreateSubmission(user) && (
            <Link to="/submissions/new" className="btn-primary">
              + Put forward
            </Link>
          )}
        </div>
=======
  function applySearch(event) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-tertiary-900">Submissions</h1>
          <p className="mt-1 text-xs text-tertiary-500">Candidates put forward for jobs, by pipeline stage.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y bg-white py-2">
        <span className="px-1 text-xs font-semibold text-primary-700">Basic</span>
        <form onSubmit={applySearch} className="flex">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidate or job"
            className="w-56 rounded-l border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="rounded border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Stage: All</option>
          {[
            'sourced', 'internal_screening', 'submitted_to_client', 'interview_scheduled',
            'interview_result', 'offer', 'bgv', 'closed', 'backout', 'rejected',
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
>>>>>>> Stashed changes
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-tertiary-50 text-xs uppercase text-tertiary-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Work</th>
              <th className="px-3 py-2 text-left font-medium">Job</th>
              <th className="px-3 py-2 text-left font-medium">Stage</th>
              <th className="px-3 py-2 text-left font-medium">Rate</th>
              <th className="px-3 py-2 text-left font-medium">Margin</th>
              <th className="px-3 py-2 text-left font-medium">Recruiter</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-tertiary-400">Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-tertiary-400">No records found</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-tertiary-50">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-primary-700">{subKey(row.id)}</div>
                    <Link to={`/submissions/${row.id}`} className="font-medium text-tertiary-900 hover:underline">
                      {row.profile?.name || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-tertiary-700">{row.requirement?.title || '—'}</td>
                  <td className="px-3 py-2"><Badge value={row.stage} /></td>
                  <td className="px-3 py-2 text-tertiary-700">
                    {row.proposed_rate ? `${row.proposed_rate_currency} ${row.proposed_rate}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-tertiary-700">{row.margin != null ? row.margin : '—'}</td>
                  <td className="px-3 py-2 text-tertiary-700">{row.submitted_by?.name || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="border-t px-3 py-2 text-xs text-tertiary-500">
          {rows.length} of {rows.length}
        </div>
      </div>
    </div>
  );
}
