import { CalendarX } from 'lucide-react';
import { roundGroupBorder } from '../../lib/interviewRounds.js';
import { formatTime } from './monthGrid.js';

/**
 * One compact event in a month-grid day cell: "HH:MM · Candidate", left-border
 * color by round-type group. Cancelled → struck-through + dimmed + a tiny icon.
 */
export default function EventPill({ event, onClick }) {
  const cancelled = event.status === 'cancelled';
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${formatTime(event.scheduled_at)} · ${event.candidate_name || 'Interview'}`}
      className={`flex w-full items-center gap-1 truncate rounded border-l-2 bg-white px-1.5 py-0.5 text-left text-[11px] shadow-soft transition-colors hover:bg-tertiary-50 ${roundGroupBorder(
        event.round_type
      )} ${cancelled ? 'text-tertiary-400 line-through opacity-60' : 'text-tertiary-700'}`}
    >
      {cancelled && <CalendarX className="h-3 w-3 shrink-0" />}
      <span className="shrink-0 font-medium">{formatTime(event.scheduled_at)}</span>
      <span className="truncate">{event.candidate_name || 'Interview'}</span>
    </button>
  );
}
