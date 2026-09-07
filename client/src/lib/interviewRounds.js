/**
 * Shared interview-round presentation: type list, per-type pill colors, result
 * colors, and grouping helpers. Imported by InterviewRoundsPanel, the calendar
 * (pills / cards / drawers), and pipeline round chips so they never drift.
 *
 * Keep round type values in sync with server/src/modules/submissions/stageMachines.js.
 */

export const ROUND_TYPES = [
  { value: 'internal_r1', label: 'Internal Round 1', group: 'internal', color: 'bg-sky-50 text-sky-800 border-sky-200' },
  { value: 'internal_r2', label: 'Internal Round 2', group: 'internal', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { value: 'client_r1', label: 'Client Round 1', group: 'client', color: 'bg-violet-50 text-violet-800 border-violet-200' },
  { value: 'client_r2', label: 'Client Round 2', group: 'client', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { value: 'client_r3', label: 'Client Round 3', group: 'client', color: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { value: 'hr_cto_ceo', label: 'HR, CTO & CEO Round', group: 'hr', color: 'bg-amber-50 text-amber-900 border-amber-200' },
];

export const RESULT_COLORS = {
  pending: 'bg-tertiary-100 text-tertiary-700',
  pass: 'bg-success-50 text-success-700',
  fail: 'bg-danger-50 text-danger-700',
  no_show: 'bg-warning-50 text-warning-800',
  rescheduled: 'bg-sky-50 text-sky-800',
};

export const RESULT_LABELS = {
  pending: 'Pending',
  pass: 'Pass',
  fail: 'Fail',
  no_show: 'Candidate did not join',
  rescheduled: 'Rescheduled',
};

export const ROUND_RESULTS = ['pending', 'pass', 'fail', 'no_show', 'rescheduled'];

export function resultLabel(result) {
  return RESULT_LABELS[result] || String(result || '').replace(/_/g, ' ');
}

// Left-border accent color per round-type group — used by calendar event pills.
export const ROUND_GROUP_BORDER = {
  internal: 'border-l-sky-400',
  client: 'border-l-violet-400',
  hr: 'border-l-amber-400',
};

// Legend dots for the calendar toolbar (legacy round-group).
export const ROUND_GROUP_LEGEND = [
  { key: 'internal', label: 'Internal', dot: 'bg-sky-400' },
  { key: 'client', label: 'Client', dot: 'bg-violet-400' },
  { key: 'hr', label: 'HR / CxO', dot: 'bg-amber-400' },
  { key: 'cancelled', label: 'Cancelled', dot: 'bg-tertiary-300' },
];

/**
 * Calendar colour model — TWO independent signals:
 *   • FILL colour = interview category (audience): internal = sky/blue,
 *     external (client-facing) = violet/purple. Only these two.
 *   • STATUS = shown as a Badge on cards / hover / detail, plus:
 *       cancelled   → grey, struck (overrides the fill)
 *       rescheduled → same fill, dimmed + struck
 *   Outcomes (pass / fail / no_show / completed) keep the audience fill; the
 *   result Badge carries the meaning.
 */
export const STATUS_LEGEND = [
  { key: 'internal', label: 'Internal interview', dot: 'bg-sky-500' },
  { key: 'external', label: 'External / client interview', dot: 'bg-violet-500' },
  { key: 'cancelled', label: 'Cancelled — grey & struck', dot: 'bg-slate-400' },
  { key: 'rescheduled', label: 'Rescheduled — dimmed & struck', dot: 'bg-slate-300' },
];

const AUDIENCE_LOOK = {
  internal: {
    pill: 'bg-sky-500/15 text-sky-900 border-sky-200',
    pillBar: 'bg-sky-500',
    block: 'bg-sky-500 text-white',
    accent: 'border-l-sky-500',
    card: 'border-sky-200 bg-sky-50/50',
  },
  external: {
    pill: 'bg-violet-500/15 text-violet-900 border-violet-200',
    pillBar: 'bg-violet-500',
    block: 'bg-violet-500 text-white',
    accent: 'border-l-violet-500',
    card: 'border-violet-200 bg-violet-50/50',
  },
};

const CANCELLED_LOOK = {
  key: 'cancelled',
  pill: 'bg-slate-100 text-slate-500 border-slate-200 opacity-70',
  pillBar: 'bg-slate-400',
  block: 'bg-slate-300 text-slate-600 line-through opacity-70',
  accent: 'border-l-slate-400',
  card: 'border-slate-200 bg-slate-50 opacity-65',
  isMuted: true,
  isStruck: true,
};

/**
 * Resolve calendar appearance. Fill follows the audience (internal/external);
 * cancelled overrides to grey; rescheduled dims + strikes the audience fill.
 */
export function eventAppearance(event) {
  const audience = event ? eventAudience(event) : 'internal';
  const base = AUDIENCE_LOOK[audience] || AUDIENCE_LOOK.internal;

  if (event?.status === 'cancelled') return CANCELLED_LOOK;

  if (event?.result === 'rescheduled') {
    return {
      key: 'rescheduled',
      pill: `${base.pill} opacity-70`,
      pillBar: base.pillBar,
      block: `${base.block} line-through opacity-60`,
      accent: base.accent,
      card: `${base.card} opacity-70`,
      isMuted: true,
      isStruck: true,
    };
  }

  return { key: audience, ...base, isMuted: false, isStruck: false };
}

export function isEventStruck(event) {
  return eventAppearance(event).isStruck;
}

export function roundTypeMeta(type) {
  return ROUND_TYPES.find((t) => t.value === type) || ROUND_TYPES[0];
}

export function audienceForRoundType(roundType) {
  return roundTypeMeta(roundType).group === 'client' ? 'external' : 'internal';
}

export function eventAudience(event) {
  return event?.audience || audienceForRoundType(event?.round_type);
}

export function roundTypeLabel(type) {
  return roundTypeMeta(type).label;
}

export function roundTypeGroup(type) {
  return roundTypeMeta(type).group;
}

export function roundGroupBorder(type) {
  return ROUND_GROUP_BORDER[roundTypeGroup(type)] || 'border-l-tertiary-300';
}

export function resultColor(result) {
  return RESULT_COLORS[result] || RESULT_COLORS.pending;
}
