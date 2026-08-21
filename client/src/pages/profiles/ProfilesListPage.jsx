import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { apiErrorMessage, canCreateProfile, profileKey } from './profileUtils.js';

export default function ProfilesListPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  useEffect(() => {
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
  }, [appliedSearch, page, source]);

  function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-tertiary-900">Candidates</h1>
          <p className="mt-1 text-xs text-tertiary-500">Profiles with skills, CTC, and resume attachments.</p>
        </div>
        {canCreateProfile(user) && <Link to="/profiles/new" className="btn-primary">+ Add candidate</Link>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y bg-white py-2">
        <span className="px-1 text-xs font-semibold text-primary-700">Basic</span>
        <form onSubmit={applySearch} className="flex">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, company, skills…"
            className="w-64 rounded-l border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={source}
          onChange={(event) => {
            setPage(1);
            setSource(event.target.value);
          }}
          className="rounded border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Source: All</option>
          <option value="internal">Internal</option>
          <option value="vendor">Vendor</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-left">
          <thead className="border-b bg-tertiary-50 text-xs text-tertiary-500">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Exp</th>
              <th className="px-3 py-2 font-medium">Skills</th>
              <th className="px-3 py-2 font-medium">Expected CTC</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-tertiary-400">Loading candidates…</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-primary-50/50">
                <td className="min-w-56 px-3 py-2">
                  <Link to={`/profiles/${row.id}`} className="font-medium text-primary-700 hover:underline">
                    {profileKey(row.id)}
                  </Link>
                  <span className="ml-2 text-tertiary-900">{row.name}</span>
                </td>
                <td className="px-3 py-2 text-tertiary-700">{row.current_company || '—'}</td>
                <td className="px-3 py-2 text-tertiary-700">{row.total_experience_years}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(row.primary_skills || []).slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">{skill}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-tertiary-700">
                  {row.expected_ctc != null ? `${row.expected_ctc_currency} ${row.expected_ctc}` : '—'}
                </td>
                <td className="px-3 py-2"><Badge value={row.source} /></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-tertiary-400">No candidates match these filters.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t bg-tertiary-50 px-3 py-2 text-xs text-tertiary-500">
          <span>{rows.length} of {pagination.total}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">
              Previous
            </button>
            <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
            <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border bg-white px-2 py-1 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
