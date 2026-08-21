/**
 * Simple KPI card — real headline number + optional caption. No fake charts.
 */
export default function KpiCard({ label, value, hint, accent = false }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft transition-colors ${
        accent ? 'border-primary-600 bg-primary-600 text-white' : 'bg-white'
      }`}
    >
      <div className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-primary-100' : 'text-tertiary-500'}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? 'text-white' : 'text-tertiary-900'}`}>
        {value ?? '—'}
      </div>
      {hint && (
        <div className={`mt-1.5 text-xs ${accent ? 'text-primary-100' : 'text-tertiary-400'}`}>{hint}</div>
      )}
    </div>
  );
}
