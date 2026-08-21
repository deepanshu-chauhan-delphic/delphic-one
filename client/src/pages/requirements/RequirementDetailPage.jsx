import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import {
  canChangeSeatStage,
  canMutateRequirement,
  nextRequirementStatuses,
  nextSeatStatuses,
  requiresDropReason,
  requiresJoinedAt,
} from '../../lib/requirementStages.js';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function RequirementDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [seats, setSeats] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [statusModal, setStatusModal] = useState(null);
  const [seatModal, setSeatModal] = useState(null);
  const [reason, setReason] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [addSeatOpen, setAddSeatOpen] = useState(false);
  const [seatLabel, setSeatLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqRes, seatsRes, assignRes, histRes] = await Promise.all([
        apiClient.get(`/requirements/${id}`),
        apiClient.get(`/requirements/${id}/seats`),
        apiClient.get(`/requirements/${id}/assignments`),
        apiClient.get(`/requirements/${id}/history`),
      ]);
      setRequirement(reqRes.data.data);
      setSeats(seatsRes.data.data || []);
      setAssignments(assignRes.data.data || []);
      setHistory(histRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requirement');
      setRequirement(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = canMutateRequirement(requirement, user);
  const canSeat = canChangeSeatStage(user);
  const locked = Boolean(requirement?.is_locked);

  async function confirmRequirementStatus() {
    if (!statusModal) return;
    setBusy(true);
    setError('');
    try {
      const body = { to_status: statusModal };
      if (requiresDropReason(statusModal)) body.reason = reason.trim();
      await apiClient.post(`/requirements/${id}/status`, body);
      setStatusModal(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Status change failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSeatStage() {
    if (!seatModal) return;
    setBusy(true);
    setError('');
    try {
      const body = { to_status: seatModal.toStatus };
      if (requiresDropReason(seatModal.toStatus)) body.reason = reason.trim();
      if (requiresJoinedAt(seatModal.toStatus)) body.joined_at = joinedAt || new Date().toISOString();
      await apiClient.post(`/seats/${seatModal.seatId}/stage`, body);
      setSeatModal(null);
      setReason('');
      setJoinedAt('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Seat stage change failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAddSeat() {
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/requirements/${id}/seats`, {
        seat_label: seatLabel.trim() || undefined,
      });
      setAddSeatOpen(false);
      setSeatLabel('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add seat');
    } finally {
      setBusy(false);
    }
  }

  function openStatus(toStatus) {
    setReason('');
    setStatusModal(toStatus);
  }

  function openSeat(seat, toStatus) {
    setReason('');
    setJoinedAt(new Date().toISOString().slice(0, 10));
    setSeatModal({ seatId: seat.id, seatLabel: seat.seat_label || seat.id.slice(0, 8), toStatus });
  }

  if (loading) return <div className="text-sm text-tertiary-500">Loading…</div>;
  if (!requirement) {
    return (
      <div className="space-y-2">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Link to="/requirements" className="text-sm text-primary-600 hover:underline">
          ← Back to requirements
        </Link>
      </div>
    );
  }

  const nextStatuses = nextRequirementStatuses(requirement.status);
  const activeAssignments = assignments.filter((a) => !a.unassigned_at);

  const seatColumns = [
    {
      key: 'seat_label',
      header: 'Seat',
      render: (s) => s.seat_label || s.id.slice(0, 8),
    },
    {
      key: 'seat_status',
      header: 'Status',
      render: (s) => <Badge value={s.seat_status} />,
    },
    {
      key: 'subs',
      header: 'Submissions',
      render: (s) => `${s.active_submissions_count || 0} active / ${s.submissions_count || 0} total`,
    },
    {
      key: 'joined_at',
      header: 'Joined',
      render: (s) => formatDate(s.joined_at),
    },
    {
      key: 'actions',
      header: 'Move stage',
      render: (s) => {
        if (!canSeat || s.is_locked) {
          return <span className="text-xs text-tertiary-400">{s.is_locked ? 'Locked' : '—'}</span>;
        }
        const next = nextSeatStatuses(s.seat_status);
        if (!next.length) return <span className="text-xs text-tertiary-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {next.map((to) => (
              <button
                key={to}
                type="button"
                className={`text-xs ${to === 'dropped' ? 'btn-danger px-2 py-1' : 'btn-secondary px-2 py-1'}`}
                onClick={() => openSeat(s, to)}
              >
                → {to.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/requirements" className="text-xs text-primary-600 hover:underline">
            ← Requirements
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-tertiary-900">{requirement.title}</h1>
            <Badge value={requirement.status} />
            <Badge value={requirement.priority} />
            {locked && <span className="rounded bg-tertiary-100 px-2 py-0.5 text-xs text-tertiary-600">Locked</span>}
          </div>
          <p className="mt-1 text-sm text-tertiary-500">
            {requirement.account?.name || '—'} · {requirement.req_type?.replace(/_/g, ' ')} · Seats{' '}
            {requirement.seats_closed ?? 0}/{requirement.seats_total}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && !locked && (
            <Link to={`/requirements/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
          )}
          {canEdit && !locked && (
            <button type="button" className="btn-primary" onClick={() => setAddSeatOpen(true)}>
              + Add seat
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Status controls */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-tertiary-800">Requirement status</h2>
        {locked || !canEdit ? (
          <p className="mt-2 text-sm text-tertiary-500">
            {locked ? 'This requirement is locked. Admin unlock is required to change status.' : 'Only the sales owner or admin can change status.'}
          </p>
        ) : nextStatuses.length === 0 ? (
          <p className="mt-2 text-sm text-tertiary-500">No further transitions.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((to) => (
              <button
                key={to}
                type="button"
                className={to === 'dropped' ? 'btn-danger' : 'btn-secondary'}
                onClick={() => openStatus(to)}
              >
                Move to {to.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Info panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-tertiary-800">Job details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-tertiary-500">Designation</dt>
            <dd>{requirement.designation || '—'}</dd>
            <dt className="text-tertiary-500">Department</dt>
            <dd>{requirement.department || '—'}</dd>
            <dt className="text-tertiary-500">Experience</dt>
            <dd>
              {requirement.experience_min ?? '—'}–{requirement.experience_max ?? '—'} yrs
            </dd>
            <dt className="text-tertiary-500">Work mode</dt>
            <dd className="capitalize">{requirement.work_mode?.replace(/_/g, ' ') || '—'}</dd>
            <dt className="text-tertiary-500">Location</dt>
            <dd>{requirement.work_location || '—'}</dd>
            <dt className="text-tertiary-500">Engagement</dt>
            <dd className="capitalize">{requirement.engagement_type?.replace(/_/g, ' ') || '—'}</dd>
            <dt className="text-tertiary-500">Budget</dt>
            <dd>
              {requirement.budget_min ?? '—'}–{requirement.budget_max ?? '—'} {requirement.budget_currency || ''}{' '}
              {requirement.budget_type ? `(${requirement.budget_type.replace(/_/g, ' ')})` : ''}
            </dd>
            <dt className="text-tertiary-500">SLA</dt>
            <dd>{requirement.sla_days != null ? `${requirement.sla_days} days` : '—'}</dd>
            <dt className="text-tertiary-500">Start target</dt>
            <dd>{formatDate(requirement.start_date_target)}</dd>
            <dt className="text-tertiary-500">Sales owner</dt>
            <dd>{requirement.sales_owner?.name || '—'}</dd>
          </dl>
          {requirement.description && (
            <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm text-tertiary-700">{requirement.description}</p>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold text-tertiary-800">Skills & assignees</h2>
          <div className="mt-3">
            <p className="text-xs font-medium text-tertiary-500">Primary stack</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(requirement.primary_tech_stack || []).length === 0 && <span className="text-sm text-tertiary-400">—</span>}
              {(requirement.primary_tech_stack || []).map((t) => (
                <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs font-medium text-tertiary-500">Assigned recruiters</p>
            <ul className="mt-1 space-y-1 text-sm">
              {(requirement.assigned_recruiters || []).length === 0 && (
                <li className="text-tertiary-400">None yet (assign UI is RD-106)</li>
              )}
              {(requirement.assigned_recruiters || []).map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-tertiary-100 text-xs font-medium">
                    {r.name.slice(0, 2).toUpperCase()}
                  </span>
                  {r.name}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-tertiary-500">Assignment history</p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-auto text-xs text-tertiary-600">
              {assignments.length === 0 && <li className="text-tertiary-400">No assignments</li>}
              {assignments.map((a) => (
                <li key={a.id}>
                  {a.user?.name} ({a.role_on_req}) — {formatDate(a.assigned_at)}
                  {a.unassigned_at ? ` → ended ${formatDate(a.unassigned_at)}` : ' · active'}
                </li>
              ))}
            </ul>
            {activeAssignments.length > 0 && (
              <p className="mt-1 text-xs text-tertiary-400">{activeAssignments.length} active assignment(s)</p>
            )}
          </div>
        </section>
      </div>

      {/* Seats */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-tertiary-800">Seats</h2>
          <span className="text-xs text-tertiary-500">{seats.length} seat(s)</span>
        </div>
        <DataTable columns={seatColumns} rows={seats} emptyLabel="No seats yet" />
        <p className="text-xs text-tertiary-400">
          Seat path: open → interviewing → offer → bgv → closed (joined date required). Drop needs a reason.
        </p>
      </section>

      {/* History */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold text-tertiary-800">Status history</h2>
        <ul className="mt-2 space-y-1 text-sm text-tertiary-700">
          {history.length === 0 && <li className="text-tertiary-400">No status changes yet</li>}
          {history.map((h) => (
            <li key={h.id}>
              <span className="capitalize">{h.from_stage?.replace(/_/g, ' ') || '—'}</span>
              {' → '}
              <span className="capitalize font-medium">{h.to_stage?.replace(/_/g, ' ')}</span>
              <span className="text-tertiary-400"> · {formatDate(h.changed_at)}</span>
              {h.reason && <span className="text-tertiary-500"> — {h.reason}</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* Requirement status modal */}
      <Modal
        open={Boolean(statusModal)}
        title={`Move requirement to ${statusModal?.replace(/_/g, ' ') || ''}`}
        onClose={() => !busy && setStatusModal(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStatusModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || (requiresDropReason(statusModal) && !reason.trim())}
              onClick={confirmRequirementStatus}
            >
              Confirm
            </button>
          </>
        }
      >
        {statusModal === 'closed' && (
          <p className="mb-2 text-tertiary-600">All seats must already be closed or dropped.</p>
        )}
        {requiresDropReason(statusModal) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Reason *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Why is this being dropped?"
            />
          </div>
        )}
        {!requiresDropReason(statusModal) && statusModal !== 'closed' && (
          <p className="text-tertiary-600">Confirm moving this requirement to {statusModal?.replace(/_/g, ' ')}.</p>
        )}
      </Modal>

      {/* Seat stage modal */}
      <Modal
        open={Boolean(seatModal)}
        title={`Move ${seatModal?.seatLabel || 'seat'} → ${seatModal?.toStatus?.replace(/_/g, ' ') || ''}`}
        onClose={() => !busy && setSeatModal(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setSeatModal(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={
                busy ||
                (requiresDropReason(seatModal?.toStatus) && !reason.trim()) ||
                (requiresJoinedAt(seatModal?.toStatus) && !joinedAt)
              }
              onClick={confirmSeatStage}
            >
              Confirm
            </button>
          </>
        }
      >
        {requiresDropReason(seatModal?.toStatus) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Reason *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        )}
        {requiresJoinedAt(seatModal?.toStatus) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Joined date *</label>
            <input
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        )}
        {!requiresDropReason(seatModal?.toStatus) && !requiresJoinedAt(seatModal?.toStatus) && (
          <p className="text-tertiary-600">Confirm this seat stage change.</p>
        )}
      </Modal>

      {/* Add seat modal */}
      <Modal
        open={addSeatOpen}
        title="Add seat"
        onClose={() => !busy && setAddSeatOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAddSeatOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={confirmAddSeat}>
              Add seat
            </button>
          </>
        }
      >
        <label className="mb-1 block text-xs font-medium text-tertiary-500">Label (optional)</label>
        <input
          value={seatLabel}
          onChange={(e) => setSeatLabel(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. Seat 3 — Backend"
        />
      </Modal>
    </div>
  );
}
