const COLOR_MAP = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  on_hold: 'bg-tertiary-100 text-tertiary-700',
  closed: 'bg-green-50 text-green-700',
  dropped: 'bg-red-50 text-red-700',
  active: 'bg-green-50 text-green-700',
  lead: 'bg-tertiary-100 text-tertiary-700',
  meeting_scheduled: 'bg-blue-50 text-blue-700',
  rescheduled: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
  high: 'bg-amber-50 text-amber-700',
  medium: 'bg-blue-50 text-blue-700',
  low: 'bg-tertiary-100 text-tertiary-700',
};

export default function Badge({ value }) {
  const classes = COLOR_MAP[value] || 'bg-tertiary-100 text-tertiary-700';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${classes}`}>{String(value).replace(/_/g, ' ')}</span>;
}
