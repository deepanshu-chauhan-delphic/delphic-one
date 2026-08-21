import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { ROLE_COPY, statsForRole } from './dashboardWidgets.js';

function entityPath(entityType, entityId) {
  if (entityType === 'account') return `/accounts/${entityId}`;
  if (entityType === 'requirement') return `/requirements/${entityId}`;
  if (entityType === 'submission') return `/submissions/${entityId}`;
  return null;
}

function StuckLeadsPanel({ rows }) {
  return (
    <section className="rounded border bg-white">
      <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Stuck leads</h2>
      <ul className="divide-y">
        {(rows || []).map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <Link to={`/accounts/${row.id}`} className="font-medium text-primary-700 hover:underline">
              {row.name}
            </Link>
            <span className="shrink-0 text-xs text-amber-700">{row.days_in_stage}d in stage</span>
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
    <section className="rounded border bg-white">
      <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Stuck requirements</h2>
      <ul className="divide-y">
        {(rows || []).map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
            <div className="min-w-0">
              <Link to={`/requirements/${row.id}`} className="font-medium text-primary-700 hover:underline">
                {row.title}
              </Link>
              <div className="mt-0.5 text-xs text-tertiary-500">{row.submissions_count} submissions</div>
            </div>
            <span className="shrink-0 text-xs text-amber-700">{row.days_open}d open</span>
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
    <section className="rounded border bg-white">
      <h2 className="border-b bg-tertiary-50 px-4 py-2 text-sm font-semibold text-tertiary-800">Recent activity</h2>
      <ul className="divide-y">
        {(rows || []).map((item, index) => {
          const path = entityPath(item.entity_type, item.entity_id);
          const label = item.entity_label || item.entity_type;
          return (
            <li key={`${item.entity_id}-${item.timestamp}-${index}`} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
              <div className="min-w-0 text-tertiary-700">
                <span className="font-medium text-tertiary-900">{item.user?.name || 'Someone'}</span>
                {' '}
                {item.action}
                {' on '}
                {path ? (
                  <Link to={path} className="text-primary-700 hover:underline">
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

function PipelineFunnel({ funnel }) {
  const data = Object.entries(funnel || {}).map(([stage, count]) => ({ stage, count }));
  const hasData = data.some((row) => row.count > 0);

  return (
    <section className="rounded border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-tertiary-800">Pipeline funnel</h2>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-tertiary-400">No pipeline data yet.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="rgb(55 99 244)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/dashboard/summary')
      .then(({ data }) => setSummary(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const role = user?.role || 'admin';
  const copy = ROLE_COPY[role] || ROLE_COPY.admin;
  const stats = statsForRole(role, summary);
  const showStuckLeads = role === 'admin' || role === 'bda';
  const showStuckRequirements = role === 'admin' || role === 'sales' || role === 'recruiter';
  const showFunnel = role === 'admin' || role === 'sales' || role === 'recruiter';

  return (
    <div className="space-y-4">
      <div className="border-b pb-3">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">
          {user?.name ? `${user.name}'s Dashboard` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-tertiary-500">{copy.subtitle}</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading && !summary ? (
        <p className="text-sm text-tertiary-400">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className={`grid gap-4 ${showFunnel ? 'xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : ''}`}>
            {showFunnel && <PipelineFunnel funnel={summary?.pipeline_funnel} />}
            <div className="space-y-4">
              {showStuckLeads && <StuckLeadsPanel rows={summary?.stuck_leads} />}
              {showStuckRequirements && <StuckRequirementsPanel rows={summary?.stuck_requirements} />}
            </div>
          </div>

          <RecentActivityPanel rows={summary?.recent_activity} />
        </>
      )}
    </div>
  );
}
