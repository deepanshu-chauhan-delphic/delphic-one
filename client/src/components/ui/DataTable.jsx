export default function DataTable({ columns, rows, loading, emptyLabel = 'No records found' }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full divide-y">
        <thead className="bg-tertiary-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-tertiary-500">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-tertiary-400">
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-tertiary-400">
                {emptyLabel}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-tertiary-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-sm text-tertiary-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
