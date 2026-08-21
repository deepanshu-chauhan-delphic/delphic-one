import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import {
  agingSections,
  chartBarsForReport,
  chartDataForReport,
  columnsForReport,
  defaultDateRange,
  reportsForRole,
  tableRowsForReport,
} from './reportViews.js';

export default function ReportsPage() {
  const { user } = useAuth();
  const available = useMemo(() => reportsForRole(user?.role || 'recruiter'), [user?.role]);
  const defaults = useMemo(() => defaultDateRange(), []);

  const [active, setActive] = useState(available[0]?.key || 'recruiter-performance');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [thresholdDays, setThresholdDays] = useState('7');
  const [groupBy, setGroupBy] = useState('month');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const canExport = user?.role === 'admin' || user?.role === 'sales';

  useEffect(() => {
    if (!available.some((r) => r.key === active) && available[0]) {
      setActive(available[0].key);
    }
  }, [available, active]);

  useEffect(() => {
    if (available.length) runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load default report once role list is known
  }, [user?.role]);

  async function runReport() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (active === 'aging') {
        params.threshold_days = thresholdDays || 7;
      } else {
        params.date_from = dateFrom;
        params.date_to = dateTo;
        if (active === 'closure') params.group_by = groupBy;
      }
      const { data } = await apiClient.get(`/reports/${active}`, { params });
      setPayload(data.data);
    } catch (err) {
      setPayload(null);
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(type) {
    setExportError('');
    setExporting(true);
    try {
      const params = new URLSearchParams({ type, report: active });
      if (active === 'aging') {
        params.set('threshold_days', thresholdDays || '7');
      } else {
        params.set('date_from', dateFrom);
        params.set('date_to', dateTo);
        if (active === 'closure') params.set('group_by', groupBy);
      }
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active}.${type === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const tableRows = tableRowsForReport(active, payload);
  const columns = columnsForReport(active);
  const chartRows = chartDataForReport(active, payload);
  const chartBars = chartBarsForReport(active);
  const aging = active === 'aging' ? agingSections(payload) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-lg font-semibold text-tertiary-900">Reports</h1>
        <span className="text-xs text-tertiary-500">
          {loading ? 'Loading…' : payload ? 'Ready' : 'Pick filters and run'}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded border bg-white px-3 py-2">
        <div>
          <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-tertiary-500">Report</label>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          >
            {available.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {active === 'aging' ? (
          <div>
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-tertiary-500">
              Threshold days
            </label>
            <input
              type="number"
              min="1"
              value={thresholdDays}
              onChange={(e) => setThresholdDays(e.target.value)}
              className="w-24 rounded border px-2 py-1.5 text-sm"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-tertiary-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-tertiary-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </>
        )}

        {active === 'closure' && (
          <div>
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-tertiary-500">Group by</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="rounded border px-2 py-1.5 text-sm">
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="client">Client</option>
              <option value="recruiter">Recruiter</option>
            </select>
          </div>
        )}

        <button type="button" className="btn-primary" onClick={runReport} disabled={loading}>
          Run
        </button>
        {canExport && (
          <>
            <button type="button" className="btn-secondary" onClick={() => exportReport('xlsx')} disabled={exporting}>
              Excel
            </button>
            <button type="button" className="btn-secondary" onClick={() => exportReport('pdf')} disabled={exporting}>
              PDF
            </button>
          </>
        )}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {exportError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</div>
      )}

      {chartRows.length > 0 && (
        <section className="rounded border bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-tertiary-800">Overview</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DFE1E6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {chartBars.map((bar) => (
                  <Bar key={bar.dataKey} dataKey={bar.dataKey} name={bar.name} fill={bar.fill} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {active === 'aging' ? (
        <div className="space-y-3">
          {aging.map((section) => (
            <section key={section.key}>
              <h2 className="mb-1 text-sm font-semibold text-tertiary-800">
                {section.title}
                <span className="ml-2 text-xs font-normal text-tertiary-500">{section.rows.length}</span>
              </h2>
              <DataTable columns={section.columns} rows={section.rows} loading={loading} emptyLabel="None" />
            </section>
          ))}
        </div>
      ) : (
        <DataTable columns={columns} rows={tableRows} loading={loading} emptyLabel="No rows for this range" />
      )}
    </div>
  );
}
