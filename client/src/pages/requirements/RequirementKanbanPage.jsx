import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Breadcrumbs from '../../components/ui/Breadcrumbs.jsx';
import {
  SUBMISSION_PIPELINE,
  canMutateSubmission,
  nextSubmissionStages,
} from '../../lib/submissionStages.js';

const BOARD_COLUMNS = [...SUBMISSION_PIPELINE, 'backout', 'rejected'];

export default function RequirementKanbanPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const canMove = canMutateSubmission(user);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqRes, subsRes] = await Promise.all([
        apiClient.get(`/requirements/${id}`),
        apiClient.get('/submissions', { params: { requirement_id: id, limit: 100 } }),
      ]);
      setRequirement(reqRes.data.data);
      setSubmissions(subsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load board');
      setRequirement(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, []]));
    for (const sub of submissions) {
      const key = map[sub.stage] ? sub.stage : 'sourced';
      map[key].push(sub);
    }
    return map;
  }, [submissions]);

  async function moveCard(submission, to_stage) {
    if (!canMove || submission.is_locked) return;
    let body = { to_stage };
    if (to_stage === 'backout') {
      const reason = window.prompt('Backout reason (required):');
      if (!reason || !reason.trim()) return;
      body.backout_reason = reason.trim();
    }
    if (to_stage === 'rejected') {
      const reason = window.prompt('Rejection reason (required):');
      if (!reason || !reason.trim()) return;
      body.rejection_reason = reason.trim();
    }
    setBusyId(submission.id);
    setError('');
    try {
      await apiClient.post(`/submissions/${submission.id}/stage`, body);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Stage move failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="text-sm text-tertiary-500">Loading board…</div>;
  if (!requirement) {
    return (
      <div className="space-y-2">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Link to="/requirements" className="text-sm text-primary-600 hover:underline">
          ← Requirements
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Requirements', to: '/requirements' },
              { label: requirement.title, to: `/requirements/${id}` },
              { label: 'Pipeline board' },
            ]}
          />
          <h1 className="mt-1 font-heading text-xl font-semibold text-tertiary-900">Pipeline board</h1>
          <p className="mt-1 text-sm text-tertiary-500">
            {requirement.account?.name || '—'} · {submissions.length} candidate(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/requirements/${id}`} className="btn-secondary">
            Job detail
          </Link>
          <button type="button" className="btn-secondary" onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((stage) => (
          <div key={stage} className="w-64 shrink-0 rounded-lg border bg-tertiary-50/80">
            <div className="flex items-center justify-between border-b bg-white px-3 py-2">
              <span className="text-xs font-semibold capitalize text-tertiary-800">{stage.replace(/_/g, ' ')}</span>
              <span className="rounded-full bg-tertiary-100 px-2 py-0.5 text-[10px] text-tertiary-600">
                {byStage[stage].length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[120px]">
              {byStage[stage].map((sub) => {
                const next = nextSubmissionStages(sub.stage);
                return (
                  <div key={sub.id} className="rounded-md border bg-white p-2 shadow-sm">
                    <Link to={`/submissions/${sub.id}`} className="text-sm font-medium text-primary-700 hover:underline">
                      {sub.profile?.name || 'Candidate'}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-tertiary-500">
                      {sub.seat?.seat_label || 'Seat'}
                      {sub.margin != null ? ` · margin ${sub.margin}` : ''}
                    </p>
                    <div className="mt-1">
                      <Badge value={sub.stage} />
                    </div>
                    {canMove && !sub.is_locked && next.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {next.slice(0, 3).map((to) => (
                          <button
                            key={to}
                            type="button"
                            disabled={busyId === sub.id}
                            className={`text-[10px] ${to === 'backout' || to === 'rejected' ? 'btn-danger px-1.5 py-0.5' : 'btn-secondary px-1.5 py-0.5'}`}
                            onClick={() => moveCard(sub, to)}
                          >
                            → {to.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {byStage[stage].length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] text-tertiary-400">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
