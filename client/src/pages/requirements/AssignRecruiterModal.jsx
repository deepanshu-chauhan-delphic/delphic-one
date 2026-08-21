import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { apiErrorMessage, canAssignRecruiters } from '../profiles/profileUtils.js';

export default function AssignRecruiterModal({ requirement, onClose }) {
  const { user } = useAuth();
  const canAssign = canAssignRecruiters(user);
  const [assignments, setAssignments] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const requests = [apiClient.get(`/requirements/${requirement.id}/assignments`)];
      if (canAssign) requests.push(apiClient.get('/users', { params: { role: 'recruiter', active: true, limit: 100 } }));
      const [assignmentsResponse, usersResponse] = await Promise.all(requests);
      setAssignments(assignmentsResponse.data.data || []);
      setRecruiters(usersResponse?.data?.data || []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to load assignments'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [requirement.id]);

  async function assignRecruiter(event) {
    event.preventDefault();
    if (!selectedRecruiterId) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/requirements/${requirement.id}/assign`, {
        user_id: selectedRecruiterId,
        role_on_req: 'recruiter',
      });
      setSelectedRecruiterId('');
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to assign recruiter'));
    } finally {
      setSaving(false);
    }
  }

  async function unassignRecruiter(assignmentId) {
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/requirements/${requirement.id}/unassign`, { assignment_id: assignmentId });
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Failed to unassign recruiter'));
    } finally {
      setSaving(false);
    }
  }

  const activeRecruiterIds = new Set(
    assignments.filter((row) => row.role_on_req === 'recruiter' && !row.unassigned_at).map((row) => row.user?.id)
  );
  const availableRecruiters = recruiters.filter((recruiter) => !activeRecruiterIds.has(recruiter.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded border bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-tertiary-900">Assign recruiters</h2>
            <p className="mt-1 text-xs text-tertiary-500">{requirement.title}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>

        <div className="space-y-4 p-4">
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {canAssign && (
            <form onSubmit={assignRecruiter} className="flex flex-wrap items-end gap-2 rounded border bg-tertiary-50 p-3">
              <label className="min-w-56 flex-1 text-xs font-medium text-tertiary-600">
                Recruiter
                <select
                  required
                  value={selectedRecruiterId}
                  onChange={(event) => setSelectedRecruiterId(event.target.value)}
                  className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Select recruiter</option>
                  {availableRecruiters.map((recruiter) => (
                    <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={saving || !selectedRecruiterId} className="btn-primary">
                {saving ? 'Saving…' : 'Assign'}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded border">
            <div className="border-b bg-tertiary-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-tertiary-500">
              Assignment history
            </div>
            {loading ? (
              <div className="px-3 py-6 text-sm text-tertiary-400">Loading…</div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-tertiary-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Person</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Assigned</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((row) => (
                    <tr key={row.id} className="hover:bg-tertiary-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-tertiary-900">{row.user?.name || '—'}</div>
                        <div className="text-xs text-tertiary-500">by {row.assigned_by?.name || '—'}</div>
                      </td>
                      <td className="px-3 py-2 capitalize">{row.role_on_req}</td>
                      <td className="px-3 py-2 text-tertiary-600">{new Date(row.assigned_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {row.unassigned_at ? (
                          <span className="text-tertiary-500">Ended {new Date(row.unassigned_at).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-green-700">Active</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canAssign && !row.unassigned_at && row.role_on_req === 'recruiter' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => unassignRecruiter(row.id)}
                            className="text-xs text-red-700 hover:underline"
                          >
                            Unassign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-tertiary-400">No assignments yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
