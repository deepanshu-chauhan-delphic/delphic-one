import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import { useClientAccountOptions, useRequirementOptions } from '../../lib/lookups.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import SearchableSelect from '../../components/ui/SearchableSelect.jsx';

const CURRENCIES = ['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'];

function money(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NewRateDrawer({ open, onClose, onSubmit }) {
  const accountOptions = useClientAccountOptions(open);
  const requirementOptions = useRequirementOptions(open);
  const [fields, setFields] = useState({ account_id: '', requirement_id: '', rate_type: 'hourly', rate: '', currency: 'INR', effective_from: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFields({ account_id: '', requirement_id: '', rate_type: 'hourly', rate: '', currency: 'INR', effective_from: new Date().toISOString().slice(0, 10) });
  }, [open]);

  function set(key, value) { setFields((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ ...fields, requirement_id: fields.requirement_id || undefined, rate: Number(fields.rate) });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="New billing rate" onClose={onClose} size="sm" tone="create" footer={
      <>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" form="billing-rate-form" className="btn-primary" disabled={saving || !fields.account_id || !fields.rate}>{saving ? 'Saving…' : 'Save rate'}</button>
      </>
    }>
      <form id="billing-rate-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-600">Client</label>
          <SearchableSelect value={fields.account_id} onChange={(v) => set('account_id', v)} options={accountOptions} placeholder="Select client" searchPlaceholder="Search clients…" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-600">Requirement <span className="font-normal text-tertiary-400">(optional — overrides the account-wide rate for this job only)</span></label>
          <SearchableSelect value={fields.requirement_id} onChange={(v) => set('requirement_id', v)} options={requirementOptions} placeholder="Account-wide (all requirements)" searchPlaceholder="Search requirements…" allowClear />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-tertiary-600">Rate type
            <select value={fields.rate_type} onChange={(e) => set('rate_type', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
              <option value="hourly">Hourly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-600">Rate<input required type="number" min="0" step="0.01" value={fields.rate} onChange={(e) => set('rate', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-tertiary-600">Currency
            <select value={fields.currency} onChange={(e) => set('currency', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-tertiary-600">Effective from<input required type="date" value={fields.effective_from} onChange={(e) => set('effective_from', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
        </div>
        <p className="text-xs text-tertiary-500">Feeds daily revenue computation (Finance → Accounting → Invoicing). A requirement-specific rate wins over the account-wide one when both apply.</p>
      </form>
    </Drawer>
  );
}

/** Billing rate admin — per-client (and optionally per-requirement) hourly/monthly rates. Admin-only. */
export default function BillingRatesTab() {
  const { pushError, pushInfo } = useAlerts();
  const accountOptions = useClientAccountOptions(true);
  const requirementOptions = useRequirementOptions(true);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const accountLabel = useMemo(() => new Map(accountOptions.map((o) => [o.value, o.label])), [accountOptions]);
  const requirementLabel = useMemo(() => new Map(requirementOptions.map((o) => [o.value, o.label])), [requirementOptions]);

  function load() {
    setLoading(true);
    apiClient.get('/billing/rates').then(({ data }) => setRows(data.data || [])).catch((err) => pushError(apiErrorMessage(err, 'Failed to load billing rates'), 'Something went wrong')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function create(payload) {
    try {
      await apiClient.post('/billing/rates', payload);
      pushInfo('Billing rate saved');
      load();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to save billing rate'), 'Something went wrong');
      throw err;
    }
  }

  const columns = [
    { key: 'account', header: 'Client', render: (row) => accountLabel.get(row.account_id) || '—' },
    { key: 'requirement', header: 'Requirement', render: (row) => (row.requirement_id ? requirementLabel.get(row.requirement_id) || '—' : <span className="text-tertiary-400">Account-wide</span>) },
    { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.rate_type}</span> },
    { key: 'rate', header: 'Rate', render: (row) => `${row.currency} ${money(row.rate)}${row.rate_type === 'hourly' ? '/hr' : '/mo'}` },
    { key: 'effective', header: 'Effective from', render: (row) => new Date(row.effective_from).toLocaleDateString() },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setDrawerOpen(true)}><Plus className="h-4 w-4" /> New rate</button>
      </div>
      {!loading && rows.length === 0 ? (
        <EmptyState title="No billing rates yet" description="Set a client's hourly or monthly rate before computing daily revenue." />
      ) : (
        <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No billing rates." />
      )}
      <NewRateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSubmit={create} />
    </div>
  );
}
