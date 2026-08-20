import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function AccountsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/accounts', { params: type ? { type } : {} })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [type]);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type', render: (r) => <span className="capitalize">{r.type}</span> },
    { key: 'stage', header: 'Stage', render: (r) => <Badge value={r.stage} /> },
    { key: 'industry', header: 'Industry' },
    { key: 'owner', header: 'Owner', render: (r) => r.owner?.name || '—' },
    { key: 'created_at', header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Accounts</h1>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All types</option>
          <option value="client">Client</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
