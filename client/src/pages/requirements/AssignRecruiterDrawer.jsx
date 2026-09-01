import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import SearchableSelect from '../../components/ui/SearchableSelect.jsx';
import { apiErrorMessage, canAssignRecruiters } from '../profiles/profileUtils.js';

export default function AssignRecruiterDrawer({ requirement, onClose }) {
  const { user } = useAuth();
  const { pushError } = useAlerts();
  const canAssign = canAssignRecruiters(user, requirement);
  const isSalesButNotOwner = user?.role === 'sales' && !canAssign;
  const [assignments, setAssignments] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const requests = [apiClient.get(`/requirements/${requirement.id}/assignments`)];
      if (canAssign) requests.push(apiClient.get('/users', { params: { role: 'recruiter', active: true, limit: 100 } }));
      const [assignmentsResponse, usersResponse] = await Promise.all(requests);
      setAssignments(assignmentsResponse.data.data || []);
      setRecruiters(usersResponse?.data?.data || []);
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to load assignments'), 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirement.id]);

  async function assignRecruiter(event) {
    event.preventDefault();
    if (!selectedRecruiterId) return;
    setSaving(true);
    try {
      await apiClient.post(`/requirements/${requirement.id}/assign`, {
        user_id: selectedRecruiterId,
        role_on_req: 'recruiter',
      });
      setSelectedRecruiterId('');
      await loadData();
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to assign recruiter'), 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function unassignRecruiter(assignmentId) {
    setSaving(true);
    try {
      await apiClient.post(`/requirements/${requirement.id}/unassign`, { assignment_id: assignmentId });
      await loadData();
    } catch (requestError) {
      pushError(apiErrorMessage(requestError, 'Failed to unassign recruiter'), 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const activeRecruiterIds = new Set(
    assignments.filter((row) => row.role_on_req === 'recruiter' && !row.unassigned_at).map((row) => row.user?.id)
  );
  const availableRecruiters = recruiters.filter((recruiter) => !activeRecruiterIds.has(recruiter.id));
  const active = assignments.filter((row) => !row.unassigned_at);
  const ended = assignments.filter((row) => row.unassigned_at);

  return (
    <Drawer
      open
      size="md"
      tone={canAssign ? 'edit' : 'info'}
      title={canAssign ? 'Assign recruiters' : 'Assignments'}
      onClose={onClose}
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="mb-3 text-xs text-tertiary-500">{requirement.title}</p>
      {requirement.sales_owner?.name && (
        <p className="mb-3 text-xs text-tertiary-500">
          Sales owner: <span className="font-medium text-tertiary-800">{requirement.sales_owner.name}</span>
        </p>
      )}

      {isSalesButNotOwner && (
        <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Only the sales owner (or an admin) can change recruiter assignments on this requirement.
        </p>
      )}

      {!canAssign && !isSalesButNotOwner && (
        <p className="mb-3 rounded-xl border border-tertiary-100 bg-tertiary-50 px-3 py-2 text-xs text-tertiary-600">
          View only — sign in as Admin or the Sales owner to assign or unassign recruiters.
        </p>
      )}

      {canAssign && (
        <form onSubmit={assignRecruiter} className="mb-4 space-y-2 rounded-xl border border-primary-100 bg-primary-50 p-3">
          <label className="block text-xs font-medium text-primary-900">
            Recruiter
            <SearchableSelect
              className="mt-1"
              required
              value={selectedRecruiterId}
              onChange={setSelectedRecruiterId}
              placeholder="Select recruiter"
              searchPlaceholder="Search recruiters…"
              options={availableRecruiters.map((recruiter) => ({ value: recruiter.id, label: recruiter.name }))}
            />
          </label>
          <button type="submit" disabled={saving || !selectedRecruiterId} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Assign'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-tertiary-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-700">Active</h3>
            <ul className="space-y-2">
              {active.map((row) => (
                <li key={row.id} className="rounded-xl border border-success-100 bg-success-50/50 px-3 py-2 text-sm">
                  <div className="font-medium text-tertiary-900">{row.user?.name || '—'}</div>
                  <div className="text-xs capitalize text-tertiary-500">{row.role_on_req}</div>
                  {canAssign && row.role_on_req === 'recruiter' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => unassignRecruiter(row.id)}
                      className="mt-1 text-xs font-medium text-danger-700 hover:underline"
                    >
                      Unassign
                    </button>
                  )}
                </li>
              ))}
              {active.length === 0 && <li className="text-sm text-tertiary-400">No active assignments.</li>}
            </ul>
          </div>
          {ended.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tertiary-500">Ended</h3>
              <ul className="space-y-2">
                {ended.map((row) => (
                  <li key={row.id} className="rounded-xl border bg-tertiary-50 px-3 py-2 text-sm text-tertiary-600">
                    {row.user?.name || '—'} · ended {new Date(row.unassigned_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
