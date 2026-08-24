import Tooltip from './Tooltip.jsx';

/**
 * Simple KPI card — real headline number + optional caption. No fake charts.
 * `description`, if given, explains exactly what the number counts/its scope
 * and shows on hover so the same number can't be trusted differently on
 * different screens.
 */
export default function KpiCard({ label, value, hint, description, accent = false }) {
  const card = (
    <div
      className={`h-full rounded-xl border p-3.5 transition-colors ${
        accent
          ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
          : 'border-tertiary-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
      }`}
    >
      <div className={`text-[11px] font-medium uppercase tracking-wide ${accent ? 'text-primary-100' : 'text-tertiary-500'}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${accent ? 'text-white' : 'text-tertiary-900'}`}>
        {value ?? '—'}
      </div>
      {hint && (
        <div className={`mt-1 text-xs ${accent ? 'text-primary-100' : 'text-tertiary-400'}`}>{hint}</div>
      )}
    </div>
  );

  if (!description) return card;
  return (
    <Tooltip label={description} side="bottom" block>
      {card}
    </Tooltip>
  );
}
