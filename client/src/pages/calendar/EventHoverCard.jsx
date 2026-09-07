import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import { eventAppearance, audienceForRoundType, roundTypeMeta } from '../../lib/interviewRounds.js';
import { formatTimeRange } from './monthGrid.js';

const CARD_W = 380;
const GAP = 10;

function Field({ label, children, className = '' }) {
  if (children == null || children === '') return null;
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary-400">{label}</p>
      <div className="mt-0.5 break-words text-[13px] leading-snug text-tertiary-800">{children}</div>
    </div>
  );
}

/**
 * Floating detail card for a calendar event (month pills, week/day time blocks).
 * Portalled to <body> and fixed-positioned so it escapes grid overflow.
 * Stays open while the pointer is over the card itself.
 */
export default function EventHoverCard({ event, anchorRect, onMouseEnter, onMouseLeave }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const h = ref.current?.offsetHeight || 220;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorRect.right + GAP;
    if (left + CARD_W > vw - 8) left = anchorRect.left - GAP - CARD_W;
    if (left < 8) left = Math.max(8, (vw - CARD_W) / 2);

    let top = anchorRect.top;
    if (top + h > vh - 8) top = Math.max(8, vh - 8 - h);

    setPos({ left, top });
  }, [anchorRect, event]);

  const look = eventAppearance(event);
  const meta = roundTypeMeta(event.round_type);
  const cancelled = event.status === 'cancelled';
  const when = event.scheduled_at ? new Date(event.scheduled_at) : null;
  const dateLabel = when
    ? when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;
  const interviewerNames = event.interviewers?.length
    ? event.interviewers.map((p) => p.name).join(', ')
    : event.interviewer_name || null;
  const title = event.round_name ? `${meta.label}: ${event.round_name}` : meta.label;
  const audience = event.audience || audienceForRoundType(event.round_type);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: CARD_W }}
      className={`z-[60] rounded-2xl border border-tertiary-200 bg-white p-3.5 shadow-drawer ${
        pos ? 'opacity-100' : 'opacity-0'
      } transition-opacity`}
    >
      <div className={`flex items-start gap-2 border-l-[3px] pl-2.5 ${look.accent}`}>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-snug text-tertiary-900 ${look.isStruck ? 'line-through text-tertiary-500' : ''}`}>
            {title}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Badge value={event.status} />
          {event.result && event.result !== 'pending' ? <Badge value={event.result} /> : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-tertiary-100 pt-3">
        <Field label="When">
          <span className={look.isStruck ? 'line-through text-tertiary-500' : ''}>
            {formatTimeRange(event.scheduled_at, event.duration_minutes)}
          </span>
          {dateLabel ? (
            <span className="mt-0.5 block text-xs font-normal text-tertiary-500">{dateLabel}</span>
          ) : null}
        </Field>
        <Field label="Type">
          <span className="capitalize">{audience}</span>
        </Field>
        <Field label="Scheduled by">{event.scheduled_by?.name || 'Not recorded'}</Field>
        <Field label="Candidate">
          <span className={look.isStruck ? 'line-through text-tertiary-500' : ''}>{event.candidate_name || 'Not set'}</span>
        </Field>
        <Field label="Requirement">{event.requirement_title || 'Not set'}</Field>
        <Field label="Account">{event.account_name || 'Not set'}</Field>
        <Field label="Interviewers" className="col-span-2">
          {interviewerNames || 'Not set'}
        </Field>
        {cancelled && event.cancellation_reason ? (
          <Field label="Cancelled" className="col-span-2">
            {event.cancellation_reason}
          </Field>
        ) : null}
        {(event.feedback || event.rating != null) && (
          <Field label="Feedback" className="col-span-2">
            {event.rating != null && <span className="mr-1 text-amber-700">★ {event.rating}</span>}
            {event.feedback}
          </Field>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {event.meeting_link && !cancelled && !look.isStruck ? (
          <a
            href={event.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Join meeting
          </a>
        ) : null}
        <p className="shrink-0 text-[11px] text-tertiary-400">Click for actions</p>
      </div>
    </div>,
    document.body
  );
}
