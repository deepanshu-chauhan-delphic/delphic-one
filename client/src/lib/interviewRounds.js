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

export const ROUND_RESULTS = ['pending', 'pass', 'fail', 'no_show', 'rescheduled'];

// Left-border accent color per round-type group — used by calendar event pills.
export const ROUND_GROUP_BORDER = {
  internal: 'border-l-sky-400',
  client: 'border-l-violet-400',
  hr: 'border-l-amber-400',
};

// Legend dots for the calendar toolbar.
export const ROUND_GROUP_LEGEND = [
  { key: 'internal', label: 'Internal', dot: 'bg-sky-400' },
  { key: 'client', label: 'Client', dot: 'bg-violet-400' },
  { key: 'hr', label: 'HR / CxO', dot: 'bg-amber-400' },
  { key: 'cancelled', label: 'Cancelled', dot: 'bg-tertiary-300' },
];

export function roundTypeMeta(type) {
  return ROUND_TYPES.find((t) => t.value === type) || ROUND_TYPES[0];
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
