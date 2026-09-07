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

/** Status / outcome colors for Teams-like calendar blocks. */
export const STATUS_LEGEND = [
  { key: 'scheduled', label: 'Scheduled', dot: 'bg-primary-500' },
  { key: 'completed', label: 'Completed', dot: 'bg-success-500' },
  { key: 'pass', label: 'Pass', dot: 'bg-emerald-500' },
  { key: 'fail', label: 'Fail', dot: 'bg-danger-500' },
  { key: 'no_show', label: 'Candidate did not join', dot: 'bg-warning-500' },
  { key: 'rescheduled', label: 'Rescheduled', dot: 'bg-amber-500' },
  { key: 'cancelled', label: 'Cancelled', dot: 'bg-tertiary-400' },
];

const APPEARANCE = {
  scheduled: {
    key: 'scheduled',
    pill: 'bg-primary-500/15 text-primary-900 border-primary-200',
    pillBar: 'bg-primary-500',
    block: 'bg-primary-500 text-white border-l-primary-700',
    accent: 'border-l-primary-500',
    card: 'border-primary-200 bg-primary-50/40',
    isMuted: false,
    isStruck: false,
  },
  completed: {
    key: 'completed',
    pill: 'bg-success-500/15 text-success-800 border-success-200',
    pillBar: 'bg-success-500',
    block: 'bg-success-500 text-white border-l-success-700',
    accent: 'border-l-success-500',
    card: 'border-success-200 bg-success-50/50',
    isMuted: false,
    isStruck: false,
  },
  pass: {
    key: 'pass',
    pill: 'bg-emerald-500/15 text-emerald-900 border-emerald-200',
    pillBar: 'bg-emerald-500',
    block: 'bg-emerald-500 text-white border-l-emerald-700',
    accent: 'border-l-emerald-500',
    card: 'border-emerald-200 bg-emerald-50/50',
    isMuted: false,
    isStruck: false,
  },
  fail: {
    key: 'fail',
    pill: 'bg-danger-500/15 text-danger-800 border-danger-200',
    pillBar: 'bg-danger-500',
    block: 'bg-danger-500 text-white border-l-danger-700',
    accent: 'border-l-danger-500',
    card: 'border-danger-200 bg-danger-50/40',
    isMuted: false,
    isStruck: false,
  },
  no_show: {
    key: 'no_show',
    pill: 'bg-warning-500/15 text-warning-900 border-warning-200',
    pillBar: 'bg-warning-500',
    block: 'bg-warning-500 text-white border-l-warning-700',
    accent: 'border-l-warning-500',
    card: 'border-warning-200 bg-warning-50/50',
    isMuted: false,
    isStruck: false,
  },
  rescheduled: {
    key: 'rescheduled',
    pill: 'bg-amber-100/80 text-amber-800/80 border-amber-200 opacity-80',
    pillBar: 'bg-amber-400',
    block: 'bg-amber-200/80 text-amber-900/70 border-l-amber-500 line-through opacity-75',
    accent: 'border-l-amber-400',
    card: 'border-amber-200 bg-amber-50/40 opacity-75',
    isMuted: true,
    isStruck: true,
  },
  cancelled: {
    key: 'cancelled',
    pill: 'bg-tertiary-100 text-tertiary-500 border-tertiary-200 opacity-70',
    pillBar: 'bg-tertiary-400',
    block: 'bg-tertiary-200 text-tertiary-500 border-l-tertiary-400 line-through opacity-65',
    accent: 'border-l-tertiary-300',
    card: 'border-tertiary-200 bg-tertiary-50 opacity-65',
    isMuted: true,
    isStruck: true,
  },
};

/**
 * Resolve calendar appearance from interview status + result.
 * Cancelled and rescheduled are muted with strikethrough.
 */
export function eventAppearance(event) {
  if (!event) return APPEARANCE.scheduled;
  if (event.status === 'cancelled') return APPEARANCE.cancelled;
  if (event.result === 'rescheduled') return APPEARANCE.rescheduled;
  if (event.status === 'completed') {
    if (event.result === 'pass') return APPEARANCE.pass;
    if (event.result === 'fail') return APPEARANCE.fail;
    if (event.result === 'no_show') return APPEARANCE.no_show;
    return APPEARANCE.completed;
  }
  return APPEARANCE.scheduled;
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
