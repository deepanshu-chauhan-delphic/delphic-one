import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient';
import DataTable from '../../components/ui/DataTable.jsx';

export default function ProfilesListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      apiClient
        .get('/profiles', { params: search ? { search } : {} })
        .then(({ data }) => setRows(data.data))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'current_company', header: 'Company' },
    { key: 'total_experience_years', header: 'Exp (yrs)' },
    {
      key: 'skills',
      header: 'Primary skills',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.primary_skills || []).slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
              {s}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'expected_ctc', header: 'Expected CTC', render: (r) => (r.expected_ctc ? `${r.expected_ctc_currency} ${r.expected_ctc}` : '—') },
    { key: 'source', header: 'Source', render: (r) => <span className="capitalize">{r.source}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Profiles</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, skills…"
          className="w-64 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
