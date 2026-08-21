import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { canCreateRequirement } from '../../lib/requirementStages.js';
import Badge from '../../components/ui/Badge.jsx';
import { canAssignRecruiters } from '../profiles/profileUtils.js';
import AssignRecruiterModal from './AssignRecruiterModal.jsx';

function reqKey(id) {
  return `REQ-${String(id).slice(0, 8).toUpperCase()}`;
}

export default function RequirementsListPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (appliedSearch) params.search = appliedSearch;
    apiClient
      .get('/requirements', { params })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [appliedSearch, priority, status]);

  function applySearch(event) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-tertiary-900">Requirements</h1>
          <p className="mt-1 text-xs text-tertiary-500">Open jobs, seats, and recruiter assignments.</p>
        </div>
        {canCreateRequirement(user) && (
          <Link to="/requirements/new" className="btn-primary">
            + Create
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y bg-white py-2">
        <span className="px-1 text-xs font-semibold text-primary-700">Basic</span>
        <form onSubmit={applySearch} className="flex">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or client"
            className="w-56 rounded-l border px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-r border border-l-0 bg-tertiary-50 px-3 text-xs font-medium text-tertiary-700">
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded border bg-white px-2 py-1.5 text-sm"
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
          className="rounded border bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Priority: All</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-tertiary-50 text-xs uppercase text-tertiary-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Work</th>
              <th className="px-3 py-2 text-left font-medium">Client</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Priority</th>
              <th className="px-3 py-2 text-left font-medium">Seats</th>
              <th className="px-3 py-2 text-left font-medium">Tech</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-tertiary-400">Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-tertiary-400">No records found</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-tertiary-50">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-primary-700">{reqKey(row.id)}</div>
                    <Link to={`/requirements/${row.id}`} className="font-medium text-tertiary-900 hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-tertiary-700">{row.account?.name || '—'}</td>
                  <td className="px-3 py-2"><Badge value={row.status} /></td>
                  <td className="px-3 py-2"><Badge value={row.priority} /></td>
                  <td className="px-3 py-2 text-tertiary-700">{`${row.seats_closed}/${row.seats_total}`}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(row.primary_tech_stack || []).slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/requirements/${row.id}`} className="text-xs font-medium text-primary-700 hover:underline">
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAssignTarget(row)}
                        className="text-xs font-medium text-primary-700 hover:underline"
                      >
                        {canAssignRecruiters(user) ? 'Assign' : 'Assignments'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="border-t px-3 py-2 text-xs text-tertiary-500">
          {rows.length} of {rows.length}
        </div>
      </div>

      {assignTarget && (
        <AssignRecruiterModal requirement={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  );
}
