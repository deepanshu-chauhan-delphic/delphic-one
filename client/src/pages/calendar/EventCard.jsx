import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import AvatarStack from '../../components/ui/AvatarStack.jsx';
import { roundTypeMeta } from '../../lib/interviewRounds.js';
import { formatRelative } from '../../lib/notifications/notificationLinks.js';
import { formatTimeRange } from './monthGrid.js';

/**
 * Agenda-view event row. Shows what the event is, who is on it, and only the
 * actions this user may take (server stays source of truth).
 */
export default function EventCard({ event, onOpenDetail, onFeedback, onCancel }) {
  const cancelled = event.status === 'cancelled';
  const meta = roundTypeMeta(event.round_type);
  const nowMs = new Date().getTime();
  const isPastStart = event.scheduled_at && new Date(event.scheduled_at).getTime() <= nowMs;
  const isFuture = event.scheduled_at && new Date(event.scheduled_at).getTime() > nowMs;
  const canFeedback = event.can_submit_feedback && !cancelled && isPastStart;
  const canCancel = event.can_submit_feedback && !cancelled && isFuture;

  return (
    <div className={`rounded-2xl border border-tertiary-100 bg-white p-4 shadow-card ${cancelled ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-heading text-sm font-semibold text-tertiary-900">
          {formatTimeRange(event.scheduled_at, event.duration_minutes)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${meta.color}`}>{meta.label}</span>
        <Badge value={event.status} />
        {event.result && event.result !== 'pending' && <Badge value={event.result} />}
        <span className="ml-auto text-tertiary-400">{formatRelative(event.scheduled_at)}</span>
      </div>

      <div className="mt-2 text-sm">
        <Link to={`/submissions/${event.submission_id}`} className="font-semibold text-primary-700 hover:underline">
          {event.candidate_name || 'Candidate'}
        </Link>
        <span className="text-tertiary-500">
          {event.requirement_title ? ` · ${event.requirement_title}` : ''}
          {event.account_name ? ` · ${event.account_name}` : ''}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {event.interviewers?.length > 0 ? (
          <AvatarStack people={event.interviewers} max={5} />
        ) : event.interviewer_name ? (
          <span className="text-xs text-tertiary-500">{event.interviewer_name}</span>
        ) : (
          <span className="text-xs text-tertiary-400">No interviewer</span>
        )}
        {event.meeting_link && !cancelled && (
          <a
            href={event.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Join
          </a>
        )}
      </div>

      {cancelled && (
        <div className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
          Cancelled{event.cancellation_reason ? ` — ${event.cancellation_reason}` : ''}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={() => onOpenDetail(event)}>
          Open details
        </button>
        {canFeedback && (
          <button type="button" className="btn-secondary text-xs" onClick={() => onFeedback(event)}>
            Submit feedback
          </button>
        )}
        {canCancel && (
          <button type="button" className="btn-ghost text-xs text-danger-600" onClick={() => onCancel(event)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
