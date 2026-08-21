import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { accountKey, apiErrorMessage, canCreateAccount } from './accountUtils.js';

export default function AccountsListPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  useEffect(() => {
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
  }, [appliedSearch, page, stage, type]);

  function applySearch(event) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function changeFilter(setter, value) {
    setPage(1);
    setter(value);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-tertiary-900">Clients & vendors</h1>
          <p className="mt-1 text-xs text-tertiary-500">Track lead ownership, meetings, and account stage.</p>
        </div>
        {canCreateAccount(user) && <Link to="/accounts/new" className="btn-primary">+ Create account</Link>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y bg-white py-2">
        <span className="px-1 text-xs font-semibold text-primary-700">Basic</span>
        <form onSubmit={applySearch} className="flex">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or contact"
            className="w-56 rounded-l border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={type}
          onChange={(event) => changeFilter(setType, event.target.value)}
          className="rounded border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Type: All</option>
          <option value="client">Client</option>
          <option value="vendor">Vendor</option>
        </select>
        <select
          value={stage}
          onChange={(event) => changeFilter(setStage, event.target.value)}
          className="rounded border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Stage: All</option>
          <option value="lead">Lead</option>
          <option value="meeting_scheduled">Meeting scheduled</option>
          <option value="active">Active</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="dropped">Dropped</option>
        </select>
        {(type || stage || appliedSearch) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setAppliedSearch('');
              setType('');
              setStage('');
              setPage(1);
            }}
            className="px-2 text-xs font-medium text-primary-700 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-left">
          <thead className="border-b bg-tertiary-50 text-xs text-tertiary-500">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Industry</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="w-12 px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-tertiary-400">Loading accounts…</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-primary-50/50">
                <td className="min-w-64 px-3 py-2">
                  <Link to={`/accounts/${row.id}`} className="font-medium text-primary-700 hover:underline">
                    {accountKey(row.id)}
                  </Link>
                  <span className="ml-2 text-tertiary-900">{row.name}</span>
                  {row.poc_name && <div className="mt-0.5 text-xs text-tertiary-500">{row.poc_name}</div>}
                </td>
                <td className="px-3 py-2 capitalize text-tertiary-700">{row.type}</td>
                <td className="px-3 py-2 text-tertiary-700">{row.industry || '—'}</td>
                <td className="px-3 py-2"><Badge value={row.stage} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                      {(row.owner?.name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-tertiary-700">{row.owner?.name || '—'}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-tertiary-600">{new Date(row.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/accounts/${row.id}`} aria-label={`Open ${row.name}`} className="text-lg text-tertiary-500 hover:text-primary-700">•••</Link>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-tertiary-400">No accounts match these filters.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t bg-tertiary-50 px-3 py-2 text-xs text-tertiary-500">
          <span>{rows.length} of {pagination.total}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded border bg-white px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded border bg-white px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
