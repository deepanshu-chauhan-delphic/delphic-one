import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function RequirementsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/requirements', { params: status ? { status } : {} })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [status]);

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'account', header: 'Client', render: (r) => r.account?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
    { key: 'priority', header: 'Priority', render: (r) => <Badge value={r.priority} /> },
    { key: 'seats', header: 'Seats', render: (r) => `${r.seats_closed}/${r.seats_total}` },
    {
      key: 'tech',
      header: 'Tech stack',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.primary_tech_stack || []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
              {t}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Requirements</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
