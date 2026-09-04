import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import Drawer from '../../components/ui/Drawer.jsx';
import Badge from '../../components/ui/Badge.jsx';
import AvatarStack from '../../components/ui/AvatarStack.jsx';
import { roundTypeMeta } from '../../lib/interviewRounds.js';
import { formatTimeRange } from './monthGrid.js';

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-tertiary-400">{label}</span>
      <span className="min-w-0 flex-1 text-tertiary-700">{children}</span>
    </div>
  );
}

/** Full event view + the same actions as the agenda card + a feedback preview. */
export default function EventDetailDrawer({ event, open, onClose, onFeedback, onChanged }) {
  const { pushSuccess, pushError } = useAlerts();
  const [cancelReason, setCancelReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!event) return null;
  const cancelled = event.status === 'cancelled';
  const meta = roundTypeMeta(event.round_type);
  const when = event.scheduled_at ? new Date(event.scheduled_at) : null;
  const nowMs = new Date().getTime();
  const isFuture = when && when.getTime() > nowMs;
  const isPastStart = when && when.getTime() <= nowMs;
  const canFeedback = event.can_submit_feedback && !cancelled && isPastStart;
  const canCancel = event.can_submit_feedback && !cancelled && isFuture;

  async function doCancel() {
    if (!cancelReason.trim()) {
      pushError('A cancellation reason is required');
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/interviews/${event.id}/cancel`, { reason: cancelReason.trim() });
      pushSuccess('Interview cancelled');
      setConfirming(false);
      setCancelReason('');
      onClose();
      onChanged?.();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to cancel interview'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => !busy && onClose()}
      tone={cancelled ? 'danger' : 'info'}
      size="md"
      title={`${meta.label}${event.round_name ? ` — ${event.round_name}` : ''}`}
    >
      <div className="space-y-4">
        {cancelled && (
          <div className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
            Cancelled{event.cancellation_reason ? ` — ${event.cancellation_reason}` : ''}
          </div>
        )}

        <div>
          <Row label="When">{formatTimeRange(event.scheduled_at, event.duration_minutes)} · {when?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Row>
          <Row label="Status">
            <Badge value={event.status} />{' '}
            {event.result && event.result !== 'pending' ? <Badge value={event.result} /> : null}
          </Row>
          <Row label="Candidate">
            <Link to={`/submissions/${event.submission_id}`} className="text-primary-700 hover:underline" onClick={onClose}>
              {event.candidate_name || 'Candidate'}
            </Link>
          </Row>
          <Row label="Requirement">{event.requirement_title || '—'}</Row>
          <Row label="Account">{event.account_name || '—'}</Row>
          <Row label="Interviewers">
            {event.interviewers?.length ? (
              <AvatarStack people={event.interviewers} max={6} />
            ) : (
              event.interviewer_name || '—'
            )}
          </Row>
        </div>

        {event.meeting_link && !cancelled && (
          <a
            href={event.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex w-full items-center justify-center gap-2 text-sm"
          >
            <ExternalLink className="h-4 w-4" /> Join meeting
          </a>
        )}

        {(event.feedback || event.rating != null) && (
          <div className="rounded-xl border border-tertiary-100 bg-tertiary-50/60 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-tertiary-400">Feedback</p>
            <p className="mt-1 flex items-center gap-2">
              <Badge value={event.result || 'pending'} />
              {event.rating != null && <span className="text-amber-700">★ {event.rating}</span>}
            </p>
            {event.feedback && <p className="mt-1.5 text-tertiary-600">{event.feedback}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-tertiary-100 pt-3">
          {canFeedback && (
            <button type="button" className="btn-secondary text-xs" onClick={() => onFeedback(event)}>
              Submit feedback
            </button>
          )}
          {canCancel && !confirming && (
            <button type="button" className="btn-ghost text-xs text-danger-600" onClick={() => setConfirming(true)}>
              Cancel interview
            </button>
          )}
        </div>

        {confirming && (
          <div className="rounded-xl border border-danger-200 bg-danger-50 p-3">
            <label className="block text-xs font-medium text-danger-800">
              Cancellation reason
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-danger-200 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => setConfirming(false)}>
                Keep it
              </button>
              <button type="button" className="btn-primary bg-danger-600 text-xs" disabled={busy} onClick={doCancel}>
                {busy ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
