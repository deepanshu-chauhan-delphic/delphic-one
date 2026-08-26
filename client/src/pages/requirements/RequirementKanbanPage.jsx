import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Breadcrumbs from '../../components/ui/Breadcrumbs.jsx';
import CardActionsMenu from '../../components/ui/CardActionsMenu.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import {
  SUBMISSION_PIPELINE,
  canMutateSubmission,
  nextSubmissionStages,
  requiresBackoutReason,
  requiresRejectionReason,
} from '../../lib/submissionStages.js';
import { formatStageLabel } from '../pipeline/pipelineBoardUtils.js';
import {
  DndContext,
  DragOverlay,
  DroppableColumn,
  DraggableCard,
  usePipelineSensors,
} from '../pipeline/pipelineDnd.jsx';

const BOARD_COLUMNS = [...SUBMISSION_PIPELINE, 'backout', 'rejected'];

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-tertiary-200 px-2.5 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100';

function needsReason(toStage) {
  return requiresBackoutReason(toStage) || requiresRejectionReason(toStage);
}

function StageReasonDrawer({ submission, toStage, open, error, saving, onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open, submission?.id, toStage]);

  if (!submission || !toStage) return null;

  return (
    <Drawer
      open={open}
      title={`Move to ${formatStageLabel(toStage)}`}
      onClose={() => !saving && onClose()}
      size="sm"
      tone="edit"
      footer={
        <>
          <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {saving ? 'Moving…' : 'Confirm'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>
        )}
        <label className="block text-xs font-medium text-tertiary-600">
          Reason
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>
    </Drawer>
  );
}

function KanbanCard({ submission, canMove, busy, isDragging, onMoveStage, onOpen }) {
  const next = nextSubmissionStages(submission.stage);
  const actions = [
    { key: 'open', label: 'Open submission', onClick: () => onOpen(submission.id) },
    ...(canMove && !submission.is_locked
      ? next.map((to) => ({
          key: `move-${to}`,
          label: `Move to ${formatStageLabel(to)}`,
          danger: to === 'backout' || to === 'rejected',
          disabled: busy,
          onClick: () => onMoveStage(submission, to),
        }))
      : []),
  ];

  return (
    <div
      className={`rounded-md border bg-white p-2 shadow-sm ${isDragging ? 'opacity-40 ring-2 ring-primary-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm font-medium text-primary-700 hover:underline"
          onClick={() => onOpen(submission.id)}
        >
          {submission.profile?.name || 'Candidate'}
        </button>
        <CardActionsMenu items={actions} label={`Actions for ${submission.profile?.name || 'candidate'}`} />
      </div>
      <p className="mt-0.5 text-[11px] text-tertiary-500">
        {submission.seat?.seat_label || 'Seat'}
        {submission.margin != null ? ` · margin ${submission.margin}` : ''}
      </p>
      <div className="mt-1">
        <Badge value={submission.stage} />
      </div>
    </div>
  );
}

export default function RequirementKanbanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const sensors = usePipelineSensors();
  const [requirement, setRequirement] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [overId, setOverId] = useState(null);

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

  async function postMove(submission, to_stage, reasonText) {
    setBusyId(submission.id);
    setError('');
    try {
      const body = { to_stage };
      if (requiresBackoutReason(to_stage)) body.backout_reason = reasonText?.trim();
      if (requiresRejectionReason(to_stage)) body.rejection_reason = reasonText?.trim();
      await apiClient.post(`/submissions/${submission.id}/stage`, body);
      setReasonModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Stage move failed');
    } finally {
      setBusyId(null);
    }
  }

  function requestMove(submission, to_stage) {
    if (!canMove || submission.is_locked) return;
    const allowed = nextSubmissionStages(submission.stage);
    if (!allowed.includes(to_stage)) {
      setError(`Cannot move from ${formatStageLabel(submission.stage)} to ${formatStageLabel(to_stage)}`);
      return;
    }
    if (needsReason(to_stage)) {
      setReasonModal({ submission, to_stage });
      return;
    }
    postMove(submission, to_stage);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDrag(null);
    setOverId(null);
    if (!over || !active) return;
    const submission = active.data.current?.submission;
    const toStage = String(over.id);
    if (!submission || submission.stage === toStage) return;
    requestMove(submission, toStage);
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
            {canMove ? ' · Drag cards or use the ⋯ menu' : ' · View only'}
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

      <DndContext
        sensors={sensors}
        onDragStart={(event) => setActiveDrag(event.active.data.current?.submission || null)}
        onDragOver={(event) => setOverId(event.over?.id || null)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setOverId(null);
        }}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((stage) => (
            <div key={stage} className="flex w-64 shrink-0 flex-col rounded-lg border bg-tertiary-50/80">
              <div className="flex items-center justify-between border-b bg-white px-3 py-2">
                <span className="text-xs font-semibold capitalize text-tertiary-800">
                  {formatStageLabel(stage)}
                </span>
                <span className="rounded-full bg-tertiary-100 px-2 py-0.5 text-[10px] text-tertiary-600">
                  {byStage[stage].length}
                </span>
              </div>
              <DroppableColumn id={stage} isOver={overId === stage}>
                {byStage[stage].map((sub) => (
                  <DraggableCard
                    key={sub.id}
                    id={sub.id}
                    disabled={!canMove || sub.is_locked || busyId === sub.id}
                    data={{ submission: sub, stage: sub.stage }}
                  >
                    {({ isDragging }) => (
                      <KanbanCard
                        submission={sub}
                        canMove={canMove}
                        busy={busyId === sub.id}
                        isDragging={isDragging}
                        onMoveStage={requestMove}
                        onOpen={(subId) => navigate(`/submissions/${subId}`)}
                      />
                    )}
                  </DraggableCard>
                ))}
                {byStage[stage].length === 0 && (
                  <p className="px-1 py-4 text-center text-[11px] text-tertiary-400">Drop here</p>
                )}
              </DroppableColumn>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeDrag ? (
            <div className="w-60 rounded-md border border-primary-200 bg-white p-2 shadow-lg">
              <div className="text-sm font-medium text-tertiary-900">
                {activeDrag.profile?.name || 'Candidate'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StageReasonDrawer
        submission={reasonModal?.submission}
        toStage={reasonModal?.to_stage}
        open={Boolean(reasonModal)}
        error={error}
        saving={busyId === reasonModal?.submission?.id}
        onClose={() => setReasonModal(null)}
        onConfirm={(reason) => postMove(reasonModal.submission, reasonModal.to_stage, reason)}
      />
    </div>
  );
}
