import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function SubmissionsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/submissions', { params: stage ? { stage } : {} })
      .then(({ data }) => setRows(data.data))
      .finally(() => setLoading(false));
  }, [stage]);

  const columns = [
    { key: 'profile', header: 'Candidate', render: (r) => r.profile?.name || '—' },
    { key: 'requirement', header: 'Requirement', render: (r) => r.requirement?.title || '—' },
    { key: 'stage', header: 'Stage', render: (r) => <Badge value={r.stage} /> },
    { key: 'proposed_rate', header: 'Proposed rate', render: (r) => (r.proposed_rate ? `${r.proposed_rate_currency} ${r.proposed_rate}` : '—') },
    { key: 'margin', header: 'Margin', render: (r) => (r.margin != null ? r.margin : '—') },
    { key: 'submitted_by', header: 'Recruiter', render: (r) => r.submitted_by?.name || '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Submissions</h1>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="">All stages</option>
          {[
            'sourced', 'internal_screening', 'submitted_to_client', 'interview_scheduled',
            'interview_result', 'offer', 'bgv', 'closed', 'backout', 'rejected',
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
