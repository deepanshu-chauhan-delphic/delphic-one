import FilterChip from './FilterChip.jsx';

const DATE_PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'last_quarter', label: 'Last quarter' },
  { key: 'ytd', label: 'YTD' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Dense filter bar for date presets, individual, and department pickers.
 *
 * Args:
 *   datePreset: Active preset key.
 *   onDatePresetChange: Called with preset key.
 *   dateFrom / dateTo: Custom range values (ISO date strings).
 *   onDateFromChange / onDateToChange: Custom range setters.
 *   individuals: [{ id, name }] options for the person picker.
 *   individualId: Selected individual id.
 *   onIndividualChange: Called with id or ''.
 *   departments: [{ id, name }] options for the department picker.
 *   departmentId: Selected department id.
 *   onDepartmentChange: Called with id or ''.
 *   showIndividual / showDepartment: Toggle pickers.
 *   children: Extra filter controls on the right.
 */
export default function FilterBar({
  datePreset = 'this_month',
  onDatePresetChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  individuals = [],
  individualId = '',
  onIndividualChange,
  departments = [],
  departmentId = '',
  onDepartmentChange,
  showIndividual = false,
  showDepartment = false,
  children,
}) {
  const chips = [];
  if (individualId) {
    const person = individuals.find((i) => i.id === individualId);
    if (person) chips.push({ key: 'individual', label: person.name, clear: () => onIndividualChange?.('') });
  }
  if (departmentId) {
    const dept = departments.find((d) => d.id === departmentId);
    if (dept) chips.push({ key: 'department', label: dept.name, clear: () => onDepartmentChange?.('') });
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              datePreset === preset.key
                ? 'bg-primary-600 text-white'
                : 'bg-tertiary-50 text-tertiary-600 hover:bg-tertiary-100'
            }`}
            onClick={() => onDatePresetChange?.(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-tertiary-500">
            From
            <input
              type="date"
              className="rounded-xl border px-2 py-1.5 text-sm text-tertiary-800"
              value={dateFrom || ''}
              onChange={(e) => onDateFromChange?.(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-tertiary-500">
            To
            <input
              type="date"
              className="rounded-xl border px-2 py-1.5 text-sm text-tertiary-800"
              value={dateTo || ''}
              onChange={(e) => onDateToChange?.(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {showIndividual && (
          <select
            className="rounded-xl border bg-white px-3 py-2 text-sm text-tertiary-700"
            value={individualId}
            onChange={(e) => onIndividualChange?.(e.target.value)}
            aria-label="Filter by individual"
          >
            <option value="">All people</option>
            {individuals.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        )}
        {showDepartment && (
          <select
            className="rounded-xl border bg-white px-3 py-2 text-sm text-tertiary-700"
            value={departmentId}
            onChange={(e) => onDepartmentChange?.(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        )}
        {children}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />
          ))}
        </div>
      )}
    </div>
  );
}

export { DATE_PRESETS };
