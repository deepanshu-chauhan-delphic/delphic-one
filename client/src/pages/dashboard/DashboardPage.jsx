import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { usePermissions } from '../../lib/permissions.js';
import { CHART_COLORS, CHART_PALETTE, chartTooltipStyle } from '../../lib/chartTheme.js';
import ChartCard from '../../components/ui/ChartCard.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { FUNNEL_STAGE_LABELS, ROLE_COPY, statsForRole } from './dashboardWidgets.js';

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
};

function entityPath(entityType, entityId) {
  if (entityType === 'account') return `/accounts/${entityId}`;
  if (entityType === 'requirement') return `/requirements/${entityId}`;
  if (entityType === 'submission') return `/submissions/${entityId}`;
  return null;
}

function funnelChartData(funnel) {
  return Object.entries(funnel || {}).map(([stage, count]) => ({
    stage,
    label: FUNNEL_STAGE_LABELS[stage] || stage,
    count: count || 0,
  }));
}

function StuckLeadsPanel({ rows }) {
  return (
    <section className="rounded-2xl border bg-white shadow-soft">
      <h2 className="border-b px-4 py-3 font-heading text-sm font-semibold text-tertiary-900">Stuck leads</h2>
      <ul className="divide-y">
        {(rows || []).map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <Link to={`/accounts/${row.id}`} className="font-medium text-primary-700 transition-colors hover:underline">
              {row.name}
            </Link>
            <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-700">
              {row.days_in_stage}d in stage
            </span>
          </li>
        ))}
        {(!rows || rows.length === 0) && (
          <li className="px-4 py-4 text-sm text-tertiary-400">No stuck leads (7+ days).</li>
        )}
      </ul>
    </section>
  );
}

function StuckRequirementsPanel({ rows }) {
  return (
    <section className="rounded-2xl border bg-white shadow-soft">
      <h2 className="border-b px-4 py-3 font-heading text-sm font-semibold text-tertiary-900">Stuck requirements</h2>
      <ul className="divide-y">
        {(rows || []).map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <Link to={`/requirements/${row.id}`} className="font-medium text-primary-700 transition-colors hover:underline">
                {row.title}
              </Link>
              <div className="mt-0.5 text-xs text-tertiary-500">{row.submissions_count} submissions</div>
            </div>
            <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-700">
              {row.days_open}d open
            </span>
          </li>
        ))}
        {(!rows || rows.length === 0) && (
          <li className="px-4 py-4 text-sm text-tertiary-400">No stuck requirements (7+ days).</li>
        )}
      </ul>
    </section>
  );
}

function RecentActivityPanel({ rows }) {
  return (
    <section className="rounded-2xl border bg-white shadow-soft">
      <h2 className="border-b px-4 py-3 font-heading text-sm font-semibold text-tertiary-900">Recent activity</h2>
      <ul className="divide-y">
        {(rows || []).map((item, index) => {
          const path = entityPath(item.entity_type, item.entity_id);
          const label = item.entity_label || item.entity_type;
          return (
            <li key={`${item.entity_id}-${item.timestamp}-${index}`} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 text-tertiary-700">
                <span className="font-medium text-tertiary-900">{item.user?.name || 'Someone'}</span>
                {' '}
                {item.action}
                {' on '}
                {path ? (
                  <Link to={path} className="text-primary-700 transition-colors hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span>{label}</span>
                )}
              </div>
              <time className="shrink-0 text-xs text-tertiary-400">
                {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
              </time>
            </li>
          );
        })}
        {(!rows || rows.length === 0) && (
          <li className="px-4 py-4 text-sm text-tertiary-400">No recent activity.</li>
        )}
      </ul>
    </section>
  );
}

function PipelineSection({ funnel }) {
  const data = useMemo(() => funnelChartData(funnel), [funnel]);
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const pieData = data.filter((row) => row.count > 0).map((row) => ({ name: row.label, value: row.count }));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold text-tertiary-900">Submission pipeline</h2>
          <p className="mt-0.5 text-sm text-tertiary-500">
            Live counts by stage{total > 0 ? ` · ${total} total in pipeline` : ''}
          </p>
        </div>
        {total > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.map((row) => (
              <span
                key={row.stage}
                className="rounded-full border bg-white px-2.5 py-1 text-xs tabular-nums text-tertiary-700 shadow-soft"
              >
                <span className="font-medium text-tertiary-900">{row.count}</span> {row.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Funnel" subtitle="Submissions at each stage" className="lg:col-span-2">
          {total === 0 ? (
            <p className="py-16 text-center text-sm text-tertiary-400">No submissions in the pipeline yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c6f86' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#5c6f86' }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" name="Submissions" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Stage mix" subtitle="Share of pipeline">
          {pieData.length === 0 ? (
            <p className="py-16 text-center text-sm text-tertiary-400">No stage mix yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { can } = usePermissions(user);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [datePreset, setDatePreset] = useState('this_month');

  const showDeptFilter = can('filterByDepartment');
  const role = user?.role || 'admin';
  // Admin always sees pipeline; sales/recruiter via viewPipeline.
  const showPipeline = role === 'admin' || can('viewPipeline');

  useEffect(() => {
    if (!showDeptFilter) return undefined;
    apiClient
      .get('/departments')
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => setDepartments([]));
    return undefined;
  }, [showDeptFilter]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (departmentId) params.department_id = departmentId;
    apiClient
      .get('/dashboard/summary', { params })
      .then(({ data }) => setSummary(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [departmentId]);

  const copy = ROLE_COPY[role] || ROLE_COPY.admin;
  const stats = statsForRole(role, summary);
  const showStuckLeads = role === 'admin' || role === 'bda';
  const showStuckRequirements = role === 'admin' || role === 'sales' || role === 'recruiter';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">
            {user?.name ? `${user.name}'s Dashboard` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-tertiary-500">{copy.subtitle}</p>
        </div>
      </div>

      {showDeptFilter && (
        <FilterBar
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          showDepartment
          departments={departments}
          departmentId={departmentId}
          onDepartmentChange={setDepartmentId}
        />
      )}

      {error && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>
      )}

      {loading && !summary ? (
        <div className="space-y-4">
          <Skeleton className="h-80" rounded="2xl" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-24" rounded="2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {showPipeline && (
            <motion.div {...cardMotion}>
              <PipelineSection funnel={summary?.pipeline_funnel} />
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat, index) => (
              <motion.div key={stat.label} {...cardMotion} transition={{ ...cardMotion.transition, delay: index * 0.03 }}>
                <KpiCard label={stat.label} value={stat.value} hint={stat.hint} accent={index === 0} />
              </motion.div>
            ))}
          </div>

          <div className={`grid gap-4 ${showStuckLeads || showStuckRequirements ? 'xl:grid-cols-2' : ''}`}>
            <div className="space-y-4">
              {showStuckLeads && <StuckLeadsPanel rows={summary?.stuck_leads} />}
              {showStuckRequirements && <StuckRequirementsPanel rows={summary?.stuck_requirements} />}
            </div>
            <RecentActivityPanel rows={summary?.recent_activity} />
          </div>
        </>
      )}
    </div>
  );
}
