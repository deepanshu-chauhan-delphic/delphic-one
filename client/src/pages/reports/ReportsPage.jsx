import { useState } from 'react';
import apiClient from '../../lib/apiClient';

const REPORTS = [
  { key: 'recruiter-performance', label: 'Recruiter performance' },
  { key: 'sales-performance', label: 'Sales performance' },
  { key: 'vendor-performance', label: 'Vendor performance' },
  { key: 'aging', label: 'Aging / SLA' },
  { key: 'closure', label: 'Closure report' },
];

export default function ReportsPage() {
  const [active, setActive] = useState(REPORTS[0].key);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runReport() {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/reports/${active}`, { params: { date_from: dateFrom, date_to: dateTo } });
      setRows(data.data);
    } finally {
      setLoading(false);
    }
  }

  function exportReport(type) {
    const params = new URLSearchParams({ type, report: active, date_from: dateFrom, date_to: dateTo });
    const token = localStorage.getItem('access_token');
    fetch(`/api/v1/reports/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${active}.${type}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-semibold text-tertiary-900">Reports</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">Report</label>
          <select value={active} onChange={(e) => setActive(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {REPORTS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <button className="btn-primary" onClick={runReport}>
          Run
        </button>
        <button className="btn-secondary" onClick={() => exportReport('xlsx')}>
          Download Excel
        </button>
        <button className="btn-secondary" onClick={() => exportReport('pdf')}>
          Download PDF
        </button>
      </div>

      <div className="rounded-lg border bg-white p-4">
        {loading && <div className="text-sm text-tertiary-400">Loading…</div>}
        {!loading && rows && (
          <pre className="overflow-auto text-xs text-tertiary-700">{JSON.stringify(rows, null, 2)}</pre>
        )}
        {!loading && !rows && <div className="text-sm text-tertiary-400">Select a date range and run a report.</div>}
      </div>
    </div>
  );
}
