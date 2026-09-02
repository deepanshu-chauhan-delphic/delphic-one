import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import { usePermissions, Can } from '../../lib/permissions.js';
import { CHART_COLORS, CHART_PALETTE, chartTooltipStyle } from '../../lib/chartTheme.js';
import ChartCard from '../../components/ui/ChartCard.jsx';
import { rangeForPreset } from '../../lib/datePresets.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import SearchableSelect from '../../components/ui/SearchableSelect.jsx';
import { ExcelIcon, PdfIcon } from '../../components/ui/ExportIcons.jsx';
import {
  agingSections,
  chartBarsForReport,
  chartDataForReport,
  chartTypeForReport,
  columnsForReport,
  defaultDateRange,
  reportsForRole,
  tableRowsForReport,
} from './reportViews.js';

function ReportChart({ reportKey, chartRows, chartBars }) {
  const type = chartTypeForReport(reportKey);
  if (!chartRows.length) return null;

  if (type === 'pie') {
    return (
      <ChartCard title="Overview" subtitle="Distribution">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartRows} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {chartRows.map((row, index) => (
                  <Cell key={row.label} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  }

  if (type === 'line') {
    return (
      <ChartCard title="Overview" subtitle="Trend over groups">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="closures" name="Closures" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primarySoft} />
              <Line type="monotone" dataKey="margin" name="Margin" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Overview" subtitle="Bar comparison">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {chartBars.map((bar) => (
              <Bar key={bar.dataKey} dataKey={bar.dataKey} name={bar.name} fill={bar.fill} radius={[8, 8, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-xl bg-tertiary-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-tertiary-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-tertiary-900">{value ?? '—'}</div>
    </div>
  );
}

/** account id for a coverage row (clients-without-requirements = client, recruiter-vendor-gaps = vendor). */
function coverageRowAccountId(row) {
  return row?.client?.id || row?.vendor?.id || null;
}

/**
 * Inline person picker for a coverage-report cell. Superadmin-only — changes the
 * account's owner (Sales POC / Our POC) or origin_owner (Brought by) in place.
 */
function CoveragePersonCell({ row, field, people, saving, onSave }) {
  const current = field === 'origin_owner_id' ? row.brought_by : row.sales_poc || row.our_poc;
  const options = current?.id && !people.some((p) => p.id === current.id)
    ? [{ id: current.id, name: `${current.name} (current)` }, ...people]
    : people;
  return (
    <select
      value={current?.id || ''}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onSave(coverageRowAccountId(row), field, e.target.value);
      }}
      className="max-w-[11rem] rounded-md border border-tertiary-200 bg-white px-2 py-1 text-sm text-tertiary-800 disabled:opacity-50"
    >
      {!current?.id && <option value="">—</option>}
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { pushError } = useAlerts();
  const { can } = usePermissions(user);
  const available = useMemo(() => reportsForRole(user?.role || 'recruiter'), [user?.role]);
  const defaults = useMemo(() => defaultDateRange(), []);

  const [active, setActive] = useState(available[0]?.key || 'recruiter-performance');
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [thresholdDays, setThresholdDays] = useState('7');
  const [groupBy, setGroupBy] = useState('month');
  const [departmentId, setDepartmentId] = useState('');
  const [individualId, setIndividualId] = useState('');
  // clients-without-requirements: Sales POC = account owner (bda_id), Brought by = origin_owner_id.
  const [coveragePocId, setCoveragePocId] = useState('');
  const [coverageBroughtById, setCoverageBroughtById] = useState('');
  const [coverageStage, setCoverageStage] = useState('active'); // clients-without-requirements default filter
  const [coveragePeople, setCoveragePeople] = useState([]);
  const [savingCoverageId, setSavingCoverageId] = useState(null);
  // recruiter-vendor-gaps: filter by vendor account and by the vendor's POC from our end.
  const [rvgVendorId, setRvgVendorId] = useState('');
  const [rvgPocId, setRvgPocId] = useState('');
  const [rvgVendors, setRvgVendors] = useState([]);
  const [explorerStuckOnly, setExplorerStuckOnly] = useState(false);
  const [explorerPastSlaOnly, setExplorerPastSlaOnly] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerStatus, setExplorerStatus] = useState('');
  const [departments, setDepartments] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawerRow, setDrawerRow] = useState(null);

  const isExplorer = active === 'pipeline-explorer';
  const isCoverage = active === 'clients-without-requirements' || active === 'recruiter-vendor-gaps';
  const isClientsWithoutReqs = active === 'clients-without-requirements';
  const isRvg = active === 'recruiter-vendor-gaps';
  const showDept = can('filterByDepartment');
  const INDIVIDUAL_ROLE_BY_REPORT = {
    'recruiter-performance': 'recruiter',
    'sales-performance': 'sales',
    'bda-performance': 'bda',
    'recruiter-vendor-gaps': 'recruiter',
  };
  const showIndividual = can('filterByIndividual') && Boolean(INDIVIDUAL_ROLE_BY_REPORT[active]);
  const showCoveragePeople = can('filterByIndividual') && isClientsWithoutReqs;
  const canEditCoverage = (isClientsWithoutReqs || isRvg) && Boolean(user?.is_superadmin);

  useEffect(() => {
    if (!available.some((r) => r.key === active) && available[0]) {
      setActive(available[0].key);
    }
  }, [available, active]);

  useEffect(() => {
    if (datePreset === 'custom') return;
    const range = rangeForPreset(datePreset);
    setDateFrom(range.date_from);
    setDateTo(range.date_to);
    if (datePreset === 'this_quarter' || datePreset === 'last_quarter') setGroupBy('quarter');
    else if (datePreset === 'this_month' || datePreset === 'last_month') setGroupBy('month');
  }, [datePreset]);

  useEffect(() => {
    if (!showDept) return undefined;
    apiClient
      .get('/departments')
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => setDepartments([]));
    return undefined;
  }, [showDept]);

  useEffect(() => {
    if (!showIndividual) {
      setIndividuals([]);
      return undefined;
    }
    const role = INDIVIDUAL_ROLE_BY_REPORT[active] || 'recruiter';
    apiClient
      .get('/users', { params: { role, limit: 100 } })
      .then(({ data }) => setIndividuals((data.data || []).map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => setIndividuals([]));
    return undefined;
  }, [showIndividual, active]);

  useEffect(() => {
    if (!showCoveragePeople && !canEditCoverage && !isRvg) {
      setCoveragePeople([]);
      return undefined;
    }
    apiClient
      .get('/users', { params: { active: 'true', limit: 100 } })
      .then(({ data }) =>
        setCoveragePeople(
          [...(data.data || [])]
            .map((u) => ({ id: u.id, name: u.name, role: u.role }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setCoveragePeople([]));
    return undefined;
  }, [showCoveragePeople, canEditCoverage, isRvg]);

  useEffect(() => {
    if (!isRvg) {
      setRvgVendors([]);
      return undefined;
    }
    apiClient
      .get('/accounts', { params: { type: 'vendor', limit: 100 } })
      .then(({ data }) =>
        setRvgVendors(
          [...(data.data || [])]
            .map((a) => ({ id: a.id, name: a.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setRvgVendors([]));
    return undefined;
  }, [isRvg]);

  async function saveCoverageField(clientId, field, value) {
    if (!value) return;
    setSavingCoverageId(clientId);
    try {
      await apiClient.patch(`/accounts/${clientId}`, { [field]: value });
      await runReport();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to update account'), 'Something went wrong');
    } finally {
      setSavingCoverageId(null);
    }
  }

  function buildParams() {
    const params = {};
    if (active === 'aging') {
      params.threshold_days = thresholdDays || 7;
    } else if (isCoverage) {
      // present-state coverage reports take no date range
    } else if (isExplorer) {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (explorerSearch.trim()) params.search = explorerSearch.trim();
      if (explorerStatus) params.requirement_status = explorerStatus;
      if (explorerStuckOnly) params.stuck_only = 'true';
      if (explorerPastSlaOnly) params.past_sla_only = 'true';
      params.threshold_days = thresholdDays || 7;
      params.limit = 100;
    } else {
      params.date_from = dateFrom;
      params.date_to = dateTo;
      if (active === 'closure') params.group_by = groupBy;
    }
    if (departmentId && !isCoverage) params.department_id = departmentId;
    if (individualId && active === 'recruiter-performance') params.recruiter_id = individualId;
    if (individualId && active === 'sales-performance') params.sales_id = individualId;
    if (individualId && active === 'bda-performance') params.bda_id = individualId;
    if (individualId && active === 'recruiter-vendor-gaps') params.recruiter_id = individualId;
    if (isClientsWithoutReqs && coveragePocId) params.bda_id = coveragePocId;
    if (isClientsWithoutReqs && coverageBroughtById) params.origin_owner_id = coverageBroughtById;
    if (isClientsWithoutReqs && coverageStage) params.stage = coverageStage;
    if (isRvg && rvgVendorId) params.vendor_id = rvgVendorId;
    if (isRvg && rvgPocId) params.owner_id = rvgPocId;
    return params;
  }

  async function runReport() {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/reports/${active}`, { params: buildParams() });
      setPayload(data.data);
    } catch (err) {
      setPayload(null);
      pushError(apiErrorMessage(err, 'Failed to load report'), 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (available.length) runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.role,
    active,
    dateFrom,
    dateTo,
    departmentId,
    individualId,
    thresholdDays,
    groupBy,
    coveragePocId,
    coverageBroughtById,
    coverageStage,
    rvgVendorId,
    rvgPocId,
    explorerStuckOnly,
    explorerPastSlaOnly,
    explorerStatus,
    explorerSearch,
  ]);

  async function exportReport(type) {
    setExporting(true);
    try {
      const { data: blob } = await apiClient.get('/reports/export', {
        params: { type, report: active, ...buildParams() },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active}.${type === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      let message = err.message || 'Export failed';
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          message = parsed.message || message;
        } catch {
          // response wasn't JSON — keep the generic message
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      pushError(message, 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const tableRows = tableRowsForReport(active, payload);
  const baseColumns = columnsForReport(active);
  const columns = canEditCoverage
    ? baseColumns.map((col) => {
        if (col.key === 'sales_poc' || col.key === 'our_poc') {
          return {
            ...col,
            render: (row) => (
              <CoveragePersonCell
                row={row}
                field="owner_id"
                people={coveragePeople}
                saving={savingCoverageId === coverageRowAccountId(row)}
                onSave={saveCoverageField}
              />
            ),
          };
        }
        if (col.key === 'brought_by') {
          return {
            ...col,
            render: (row) => (
              <CoveragePersonCell
                row={row}
                field="origin_owner_id"
                people={coveragePeople}
                saving={savingCoverageId === coverageRowAccountId(row)}
                onSave={saveCoverageField}
              />
            ),
          };
        }
        return col;
      })
    : baseColumns;
  const chartRows = chartDataForReport(active, payload);
  const chartBars = chartBarsForReport(active);
  const aging = active === 'aging' ? agingSections(payload) : [];

  const drawerTitle =
    drawerRow?.requirement?.title ||
    drawerRow?.recruiter?.name ||
    drawerRow?.sales_person?.name ||
    drawerRow?.vendor?.name ||
    drawerRow?.client?.name ||
    drawerRow?.bda?.name ||
    drawerRow?.group_label ||
    'Row details';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <SearchableSelect
            className="w-56"
            ariaLabel="Report type"
            value={active}
            onChange={(v) => {
              setActive(v);
              setIndividualId('');
              setCoveragePocId('');
              setCoverageBroughtById('');
              setCoverageStage('active');
              setRvgVendorId('');
              setRvgPocId('');
              setDrawerRow(null);
            }}
            searchPlaceholder="Search reports…"
            options={available.map((r) => ({ value: r.key, label: r.label }))}
          />
          <Can user={user} capability="exportReports">
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-tertiary-100 bg-white px-3 py-2 text-sm font-medium text-tertiary-700 shadow-soft transition-colors hover:bg-canvas-muted disabled:opacity-50"
                onClick={() => exportReport('xlsx')}
                disabled={exporting}
                aria-label="Export Excel"
              >
                <ExcelIcon />
                Excel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-tertiary-100 bg-white px-3 py-2 text-sm font-medium text-tertiary-700 shadow-soft transition-colors hover:bg-canvas-muted disabled:opacity-50"
                onClick={() => exportReport('pdf')}
                disabled={exporting}
                aria-label="Export PDF"
              >
                <PdfIcon />
                PDF
              </button>
            </>
          </Can>
      </div>

      <FilterBar
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        showDatePresets={active !== 'aging' && !isCoverage}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => {
          setDatePreset('custom');
          setDateFrom(v);
        }}
        onDateToChange={(v) => {
          setDatePreset('custom');
          setDateTo(v);
        }}
        showDepartment={showDept && !isExplorer && !isCoverage}
        departments={departments}
        departmentId={departmentId}
        onDepartmentChange={setDepartmentId}
        showIndividual={showIndividual}
        individuals={individuals}
        individualId={individualId}
        onIndividualChange={setIndividualId}
      >
        {showCoveragePeople && (
          <>
            <SearchableSelect
              className="w-52"
              allowClear
              ariaLabel="Filter by Brought by"
              value={coverageBroughtById}
              onChange={setCoverageBroughtById}
              placeholder="All (brought by)"
              searchPlaceholder="Search people…"
              options={coveragePeople.map((person) => ({ value: person.id, label: person.name }))}
            />
            <SearchableSelect
              className="w-52"
              allowClear
              ariaLabel="Filter by Sales POC"
              value={coveragePocId}
              onChange={setCoveragePocId}
              placeholder="All (Sales POC)"
              searchPlaceholder="Search people…"
              options={coveragePeople.map((person) => ({ value: person.id, label: person.name }))}
            />
          </>
        )}
        {isClientsWithoutReqs && (
          <SearchableSelect
            className="w-44"
            allowClear
            ariaLabel="Filter by stage"
            value={coverageStage}
            onChange={setCoverageStage}
            placeholder="All stages"
            searchPlaceholder="Search stage…"
            options={[
              { value: 'lead', label: 'Lead' },
              { value: 'meeting_scheduled', label: 'Meeting scheduled' },
              { value: 'active', label: 'Active' },
              { value: 'rescheduled', label: 'Rescheduled' },
              { value: 'dropped', label: 'Dropped' },
            ]}
          />
        )}
        {isRvg && (
          <>
            <SearchableSelect
              className="w-52"
              allowClear
              ariaLabel="Filter by vendor"
              value={rvgVendorId}
              onChange={setRvgVendorId}
              placeholder="All vendors"
              searchPlaceholder="Search vendors…"
              options={rvgVendors.map((v) => ({ value: v.id, label: v.name }))}
            />
            <SearchableSelect
              className="w-52"
              allowClear
              ariaLabel="Filter by our POC"
              value={rvgPocId}
              onChange={setRvgPocId}
              placeholder="All (our POC)"
              searchPlaceholder="Search people…"
              options={coveragePeople.map((person) => ({ value: person.id, label: person.name }))}
            />
          </>
        )}
        {active === 'aging' && (
          <label className="flex items-center gap-2 text-xs text-tertiary-500">
            Threshold days
            <input
              type="number"
              min="1"
              value={thresholdDays}
              onChange={(e) => setThresholdDays(e.target.value)}
              className="w-20 rounded-xl border px-2 py-1.5 text-sm"
            />
          </label>
        )}
        {isExplorer && (
          <>
            <input
              value={explorerSearch}
              onChange={(e) => setExplorerSearch(e.target.value)}
              placeholder="Search requirement or client…"
              className="rounded-xl border bg-white px-3 py-2 text-sm text-tertiary-700"
            />
            <SearchableSelect
              className="w-40"
              allowClear
              ariaLabel="Requirement status"
              value={explorerStatus}
              onChange={setExplorerStatus}
              placeholder="All statuses"
              searchPlaceholder="Search status…"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'on_hold', label: 'On hold' },
                { value: 'closed', label: 'Closed' },
                { value: 'dropped', label: 'Dropped' },
              ]}
            />
            <label className="flex items-center gap-2 text-xs text-tertiary-500">
              <input
                type="checkbox"
                checked={explorerStuckOnly}
                onChange={(e) => setExplorerStuckOnly(e.target.checked)}
              />
              Stuck only
            </label>
            <label className="flex items-center gap-2 text-xs text-tertiary-500">
              <input
                type="checkbox"
                checked={explorerPastSlaOnly}
                onChange={(e) => setExplorerPastSlaOnly(e.target.checked)}
              />
              Past SLA only
            </label>
            <label className="flex items-center gap-2 text-xs text-tertiary-500">
              Threshold days
              <input
                type="number"
                min="1"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
                className="w-20 rounded-xl border px-2 py-1.5 text-sm"
              />
            </label>
          </>
        )}
        {active === 'closure' && (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-sm text-tertiary-700"
            aria-label="Group by"
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="client">Client</option>
            <option value="recruiter">Recruiter</option>
          </select>
        )}
      </FilterBar>

      {chartRows.length > 0 && <ReportChart reportKey={active} chartRows={chartRows} chartBars={chartBars} />}

      {active === 'aging' ? (
        <div className="space-y-4">
          {aging.map((section) => (
            <section key={section.key} className="space-y-2">
              <h2 className="font-heading text-sm font-semibold text-tertiary-800">
                {section.title}
                <span className="ml-2 text-xs font-normal text-tertiary-500">{section.rows.length}</span>
              </h2>
              <DataTable
                columns={section.columns}
                rows={section.rows}
                loading={loading}
                emptyLabel="None"
                onRowClick={setDrawerRow}
              />
            </section>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={tableRows}
          loading={loading}
          emptyLabel="No rows for this range"
          onRowClick={setDrawerRow}
        />
      )}

      <Drawer open={Boolean(drawerRow)} title={drawerTitle} onClose={() => setDrawerRow(null)} size="md" tone="info">
        {drawerRow && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(drawerRow)
                .filter(([key, value]) => key !== 'id' && key !== 'details' && typeof value !== 'object')
                .slice(0, 16)
                .map(([key, value]) => (
                  <DetailField key={key} label={key.replace(/_/g, ' ')} value={String(value)} />
                ))}
            </div>
            {Array.isArray(drawerRow.details) && drawerRow.details.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-tertiary-800">Detail rows</h3>
                <ul className="space-y-2">
                  {drawerRow.details.map((detail, index) => (
                    <li key={detail.profile?.id || index} className="rounded-xl border px-3 py-2 text-sm">
                      <div className="font-medium text-tertiary-900">{detail.profile?.name || 'Profile'}</div>
                      <div className="text-xs text-tertiary-500">
                        {detail.requirement?.title} · {detail.client?.name} · {detail.recruiter?.name}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Can user={user} capability="exportReports">
              <p className="text-xs text-tertiary-400">
                Edit flows stay on entity detail pages. This panel is for report drill-down.
              </p>
            </Can>
          </div>
        )}
      </Drawer>
    </div>
  );
}
