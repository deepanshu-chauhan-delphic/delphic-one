import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../lib/apiClient';
import StatCard from '../../components/ui/StatCard.jsx';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/dashboard/summary')
      .then(({ data }) => setSummary(data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  const funnelData = summary
    ? Object.entries(summary.pipeline_funnel).map(([stage, count]) => ({ stage, count }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-semibold text-tertiary-900">Dashboard</h1>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active leads" value={summary?.leads_active} />
        <StatCard label="In meeting" value={summary?.leads_in_meeting} />
        <StatCard label="Active clients" value={summary?.clients_active} />
        <StatCard label="Active vendors" value={summary?.vendors_active} />
        <StatCard label="Open requirements" value={summary?.requirements_open} />
        <StatCard label="In progress" value={summary?.requirements_in_progress} />
        <StatCard label="Closed this month" value={summary?.requirements_closed_this_month} />
        <StatCard label="Active submissions" value={summary?.submissions_active} />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 text-sm font-medium text-tertiary-700">Pipeline funnel</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" />
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="rgb(55 99 244)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-tertiary-700">Recent activity</h2>
        <ul className="divide-y">
          {(summary?.recent_activity || []).map((item, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-tertiary-700">
                <span className="font-medium">{item.user?.name}</span> {item.action} on {item.entity_type}
              </span>
              <span className="text-tertiary-400">{new Date(item.timestamp).toLocaleString()}</span>
            </li>
          ))}
          {summary && summary.recent_activity.length === 0 && <li className="py-2 text-sm text-tertiary-400">No recent activity</li>}
        </ul>
      </div>
    </div>
  );
}
