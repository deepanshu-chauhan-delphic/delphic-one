import { useEffect, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import { useClientAccountOptions, useRequirementOptions } from '../../lib/lookups.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import SearchableSelect from '../../components/ui/SearchableSelect.jsx';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function EntryDrawer({ open, onClose, onSubmit }) {
  const accountOptions = useClientAccountOptions(open);
  const requirementOptions = useRequirementOptions(open);
  const [fields, setFields] = useState({ date: todayIso(), account_id: '', requirement_id: '', hours: '', billable: true, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFields({ date: todayIso(), account_id: '', requirement_id: '', hours: '', billable: true, notes: '' });
  }, [open]);

  function set(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        date: fields.date,
        account_id: fields.account_id,
        requirement_id: fields.requirement_id || undefined,
        hours: Number(fields.hours),
        billable: fields.billable,
        notes: fields.notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      title="Log time"
      onClose={onClose}
      size="md"
      tone="create"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="timesheet-entry-form" className="btn-primary" disabled={saving || !fields.account_id || !fields.hours}>
            {saving ? 'Saving…' : 'Log time'}
          </button>
        </>
      }
    >
      <form id="timesheet-entry-form" onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-medium text-tertiary-600">
          Date
          <input required type="date" max={todayIso()} value={fields.date} onChange={(e) => set('date', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </label>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-600">Client / project</label>
          <SearchableSelect value={fields.account_id} onChange={(v) => set('account_id', v)} options={accountOptions} placeholder="Select client" searchPlaceholder="Search clients…" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-tertiary-600">Requirement (optional)</label>
          <SearchableSelect value={fields.requirement_id} onChange={(v) => set('requirement_id', v)} options={requirementOptions} placeholder="Not tied to a specific requirement" allowClear searchPlaceholder="Search requirements…" />
        </div>
        <label className="block text-xs font-medium text-tertiary-600">
          Hours
          <input required type="number" min="0.5" max="24" step="0.5" value={fields.hours} onChange={(e) => set('hours', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-tertiary-700">
          <input type="checkbox" checked={fields.billable} onChange={(e) => set('billable', e.target.checked)} /> Billable
        </label>
        <label className="block text-xs font-medium text-tertiary-600">
          Notes
          <textarea value={fields.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </label>
      </form>
    </Drawer>
  );
}

function TicketDrawer({ open, entry, onClose, onSubmit }) {
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setHours(entry ? String(entry.hours) : '');
      setReason('');
    }
  }, [open, entry]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ requested_change: { hours: Number(hours) }, reason: reason.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="Request a correction" onClose={onClose} size="sm" tone="edit" footer={
      <>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" form="regularization-form" className="btn-primary" disabled={saving || !hours || !reason.trim()}>{saving ? 'Submitting…' : 'Submit request'}</button>
      </>
    }>
      <form id="regularization-form" onSubmit={submit} className="space-y-3">
        <p className="text-xs text-tertiary-500">This day is locked. Corrections go through admin review.</p>
        <label className="block text-xs font-medium text-tertiary-600">
          Corrected hours
          <input required type="number" min="0.5" max="24" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-tertiary-600">
          Reason
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
        </label>
      </form>
    </Drawer>
  );
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { pushError, pushInfo } = useAlerts();
  const [view, setView] = useState('mine');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locks, setLocks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [ticketEntry, setTicketEntry] = useState(null);
  const [lockDate, setLockDate] = useState(todayIso());

  async function loadEntries() {
    setLoading(true);
    try {
      const endpoint = view === 'team' ? '/timesheets/entries' : '/timesheets/entries/me';
      const { data } = await apiClient.get(endpoint, { params: { limit: 50 } });
      setRows(data.data || []);
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to load timesheets'), 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function loadLocks() {
    try {
      const { data } = await apiClient.get('/timesheets/locks');
      setLocks(data.data || []);
    } catch { /* non-critical */ }
  }

  async function loadTickets() {
    try {
      const { data } = await apiClient.get('/timesheets/regularization-tickets');
      setTickets(data.data || []);
    } catch { /* non-critical */ }
  }

  useEffect(() => { loadEntries(); }, [view]);
  useEffect(() => {
    if (isAdmin) {
      loadLocks();
      loadTickets();
    }
  }, [isAdmin]);

  async function createEntry(payload) {
    try {
      await apiClient.post('/timesheets/entries', payload);
      pushInfo('Time logged');
      loadEntries();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to log time'), 'Something went wrong');
      throw err;
    }
  }

  async function decideEntry(entry, status) {
    try {
      await apiClient.post(`/timesheets/entries/${entry.id}/decision`, { status });
      pushInfo(`Entry ${status}`);
      loadEntries();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to record decision'), 'Something went wrong');
    }
  }

  async function submitTicket(payload) {
    try {
      await apiClient.post(`/timesheets/entries/${ticketEntry.id}/regularization-tickets`, payload);
      pushInfo('Correction requested');
      if (isAdmin) loadTickets();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to submit correction request'), 'Something went wrong');
      throw err;
    }
  }

  async function decideTicket(ticket, status) {
    try {
      await apiClient.post(`/timesheets/regularization-tickets/${ticket.id}/decision`, { status, decision_reason: status === 'rejected' ? 'Rejected by admin' : undefined });
      pushInfo(`Correction request ${status}`);
      loadTickets();
      loadEntries();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to record decision'), 'Something went wrong');
    }
  }

  async function lockDay() {
    try {
      await apiClient.post('/timesheets/locks', { date: lockDate });
      pushInfo(`${lockDate} locked`);
      loadLocks();
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to lock day'), 'Something went wrong');
    }
  }

  const columns = [
    { key: 'date', header: 'Date', render: (row) => new Date(`${row.date}`.slice(0, 10)).toLocaleDateString() },
    ...(view === 'team' ? [{ key: 'person', header: 'Employee', render: (row) => row.org_membership?.person?.name || '—' }] : []),
    { key: 'account', header: 'Client', render: (row) => row.account?.name || '—' },
    { key: 'requirement', header: 'Requirement', render: (row) => row.requirement?.title || '—' },
    { key: 'hours', header: 'Hours', render: (row) => `${row.hours}${row.billable ? '' : ' (non-billable)'}` },
    { key: 'status', header: 'Status', render: (row) => <Badge value={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          {view === 'team' && isAdmin && row.status === 'submitted' && (
            <>
              <button type="button" className="btn-ghost text-xs" onClick={() => decideEntry(row, 'approved')}>Approve</button>
              <button type="button" className="btn-ghost text-xs text-danger-600" onClick={() => decideEntry(row, 'rejected')}>Reject</button>
            </>
          )}
          {view === 'mine' && row.status !== 'submitted' && (
            <button type="button" className="btn-ghost text-xs" onClick={() => setTicketEntry(row)}>Request correction</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 border-b border-tertiary-200">
          {['mine', ...(isAdmin ? ['team'] : [])].map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${view === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-tertiary-500'}`}
              onClick={() => setView(key)}
            >
              {key === 'mine' ? 'My timesheet' : 'Team'}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setEntryDrawerOpen(true)}>
          <Plus className="h-4 w-4" /> Log time
        </button>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={Lock} title="No timesheet entries yet" description="Log time against a client or requirement to get started." />
      ) : (
        <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No entries." />
      )}

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-tertiary-100 bg-white p-4 shadow-card">
            <h3 className="font-heading text-sm font-semibold text-tertiary-900">Daily lock</h3>
            <p className="mt-1 text-xs text-tertiary-500">Freezes every entry for that day org-wide. One-way — corrections go through the ticket flow.</p>
            <div className="mt-3 flex items-center gap-2">
              <input type="date" max={todayIso()} value={lockDate} onChange={(e) => setLockDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={lockDay}><Lock className="h-3.5 w-3.5" /> Lock day</button>
            </div>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-tertiary-600">
              {locks.map((lock) => (
                <li key={lock.id}>{new Date(`${lock.date}`.slice(0, 10)).toLocaleDateString()}</li>
              ))}
              {locks.length === 0 && <li className="text-tertiary-400">No days locked yet.</li>}
            </ul>
          </section>

          <section className="rounded-2xl border border-tertiary-100 bg-white p-4 shadow-card">
            <h3 className="font-heading text-sm font-semibold text-tertiary-900">Correction requests</h3>
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-2 rounded-lg border border-tertiary-100 p-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tertiary-800">{ticket.requester?.name || 'Employee'} · {ticket.timesheet_entry?.account?.name || '—'}</p>
                    <p className="truncate text-xs text-tertiary-500">{ticket.reason}</p>
                  </div>
                  {ticket.status === 'pending' ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="btn-ghost text-xs" onClick={() => decideTicket(ticket, 'approved')}>Approve</button>
                      <button type="button" className="btn-ghost text-xs text-danger-600" onClick={() => decideTicket(ticket, 'rejected')}>Reject</button>
                    </div>
                  ) : (
                    <Badge value={ticket.status} />
                  )}
                </li>
              ))}
              {tickets.length === 0 && <li className="text-tertiary-400">No correction requests.</li>}
            </ul>
          </section>
        </div>
      )}

      <EntryDrawer open={entryDrawerOpen} onClose={() => setEntryDrawerOpen(false)} onSubmit={createEntry} />
      <TicketDrawer open={Boolean(ticketEntry)} entry={ticketEntry} onClose={() => setTicketEntry(null)} onSubmit={submitTicket} />
    </div>
  );
}
