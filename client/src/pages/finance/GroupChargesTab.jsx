import { useEffect, useState } from 'react';
import apiClient from '../../lib/apiClient.js';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import DataTable from '../../components/ui/DataTable.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function money(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Read-only view of intra-group charges raised AGAINST this company. Raising
 * a new charge is a group-superadmin action (Group Overview → Billing
 * Charges) since it targets another company's books — this tab only shows
 * what's already been charged here, matching the backend's own split
 * (`authorize('admin')` here vs. `authorizeGroupSuperadmin` to create/list-all).
 */
export default function GroupChargesTab() {
  const { pushError } = useAlerts();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/billing/group-charges').then(({ data }) => setRows(data.data || [])).catch((err) => pushError(apiErrorMessage(err, 'Failed to load group charges'), 'Something went wrong')).finally(() => setLoading(false));
  }, [pushError]);

  const columns = [
    { key: 'period', header: 'Period', render: (row) => `${MONTHS[row.period_month - 1] || row.period_month} ${row.period_year}` },
    { key: 'kind', header: 'Kind' },
    { key: 'amount', header: 'Amount', render: (row) => `${row.currency} ${money(row.amount)}` },
    { key: 'raised', header: 'Raised', render: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-3">
      {!loading && rows.length === 0 ? (
        <EmptyState title="No intra-group charges yet" description="Service transfers raised against this company by the group (e.g. shared infrastructure, staffing) will appear here." />
      ) : (
        <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No group charges." />
      )}
    </div>
  );
}
