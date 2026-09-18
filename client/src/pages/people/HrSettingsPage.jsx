import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plus, Settings2, UsersRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const TABS = [
  { key: 'departments', label: 'Departments', icon: UsersRound },
  { key: 'designations', label: 'Designations', icon: UsersRound },
  { key: 'locations', label: 'Locations', icon: MapPin },
  { key: 'shifts', label: 'Shifts', icon: Settings2 },
  { key: 'calendars', label: 'Calendars', icon: CalendarDays },
];

function minutesToTime(value) {
  if (value === undefined || value === null) return '';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function NameDrawer({ open, title, value, onClose, onSubmit }) {
  const [name, setName] = useState(value || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setName(value || ''); }, [open, value]);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try { await onSubmit(name.trim()); onClose(); } finally { setSaving(false); }
  }
  return <Drawer open={open} title={title} onClose={onClose} size="sm" tone="create" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="settings-name-form" className="btn-primary" disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save'}</button></>}><form id="settings-name-form" onSubmit={submit}><label className="block text-xs font-medium text-tertiary-600">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label></form></Drawer>;
}

function LocationDrawer({ open, onClose, onSubmit }) {
  const [fields, setFields] = useState({ name: '', city: '', country: '', is_default: false });
  const [saving, setSaving] = useState(false);
  function set(key, value) { setFields((current) => ({ ...current, [key]: value })); }
  async function submit(event) { event.preventDefault(); setSaving(true); try { await onSubmit(fields); onClose(); } finally { setSaving(false); } }
  return <Drawer open={open} title="Add location" onClose={onClose} size="sm" tone="create" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="location-form" className="btn-primary" disabled={saving || !fields.name.trim()}>{saving ? 'Saving...' : 'Add location'}</button></>}><form id="location-form" onSubmit={submit} className="space-y-3"><label className="block text-xs font-medium text-tertiary-600">Name<input required value={fields.name} onChange={(event) => set('name', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-tertiary-600">City<input value={fields.city} onChange={(event) => set('city', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-tertiary-600">Country<input value={fields.country} onChange={(event) => set('country', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="flex items-center gap-2 text-sm text-tertiary-700"><input type="checkbox" checked={fields.is_default} onChange={(event) => set('is_default', event.target.checked)} /> Default location</label></form></Drawer>;
}

function ShiftDrawer({ open, onClose, onSubmit }) {
  const [fields, setFields] = useState({ name: '', start: '09:00', end: '18:00', grace_minutes: 15 });
  const [saving, setSaving] = useState(false);
  function set(key, value) { setFields((current) => ({ ...current, [key]: value })); }
  async function submit(event) { event.preventDefault(); setSaving(true); try { await onSubmit({ name: fields.name.trim(), start_minutes: timeToMinutes(fields.start), end_minutes: timeToMinutes(fields.end), grace_minutes: Number(fields.grace_minutes) }); onClose(); } finally { setSaving(false); } }
  return <Drawer open={open} title="Add shift" onClose={onClose} size="sm" tone="create" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="shift-form" className="btn-primary" disabled={saving || !fields.name.trim()}>{saving ? 'Saving...' : 'Add shift'}</button></>}><form id="shift-form" onSubmit={submit} className="space-y-3"><label className="block text-xs font-medium text-tertiary-600">Name<input required value={fields.name} onChange={(event) => set('name', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-tertiary-600">Start<input type="time" value={fields.start} onChange={(event) => set('start', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-tertiary-600">End<input type="time" value={fields.end} onChange={(event) => set('end', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label></div><label className="block text-xs font-medium text-tertiary-600">Grace period in minutes<input type="number" min="0" max="120" value={fields.grace_minutes} onChange={(event) => set('grace_minutes', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label></form></Drawer>;
}

function CalendarDrawer({ open, onClose, onSubmit }) {
  const [fields, setFields] = useState({ name: '', kind: 'internal', is_default: false });
  const [saving, setSaving] = useState(false);
  function set(key, value) { setFields((current) => ({ ...current, [key]: value })); }
  async function submit(event) { event.preventDefault(); setSaving(true); try { await onSubmit(fields); onClose(); } finally { setSaving(false); } }
  return <Drawer open={open} title="Add calendar" onClose={onClose} size="sm" tone="create" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="calendar-form" className="btn-primary" disabled={saving || !fields.name.trim()}>{saving ? 'Saving...' : 'Add calendar'}</button></>}><form id="calendar-form" onSubmit={submit} className="space-y-3"><label className="block text-xs font-medium text-tertiary-600">Name<input required value={fields.name} onChange={(event) => set('name', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-tertiary-600">Kind<select value={fields.kind} onChange={(event) => set('kind', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="internal">Internal</option><option value="client">Client</option><option value="custom">Custom</option></select></label><label className="flex items-center gap-2 text-sm text-tertiary-700"><input type="checkbox" checked={fields.is_default} onChange={(event) => set('is_default', event.target.checked)} /> Default calendar</label></form></Drawer>;
}

function HolidayDrawer({ open, calendar, onClose, onSubmit }) {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); setSaving(true); try { await onSubmit({ date, label }); setDate(''); setLabel(''); onClose(); } finally { setSaving(false); } }
  return <Drawer open={open} title={`Add holiday to ${calendar?.name || 'calendar'}`} onClose={onClose} size="sm" tone="create" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="holiday-form" className="btn-primary" disabled={saving || !date || !label.trim()}>{saving ? 'Saving...' : 'Add holiday'}</button></>}><form id="holiday-form" onSubmit={submit} className="space-y-3"><label className="block text-xs font-medium text-tertiary-600">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label><label className="block text-xs font-medium text-tertiary-600">Label<input required value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label></form></Drawer>;
}

export default function HrSettingsPage() {
  const { user } = useAuth();
  const { pushError, pushInfo } = useAlerts();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') || 'departments';
  const tab = TABS.some((item) => item.key === requestedTab) ? requestedTab : 'departments';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [holidayCalendar, setHolidayCalendar] = useState(null);
  const [holidays, setHolidays] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const endpoint = tab === 'departments' ? '/departments' : tab === 'designations' ? '/designations' : tab === 'locations' ? '/orgs/locations' : tab === 'shifts' ? '/attendance/shifts' : '/calendars';
      const { data } = await apiClient.get(endpoint);
      setRows(data.data || []);
    } catch (err) {
      pushError(apiErrorMessage(err, 'Failed to load HR settings'), 'Something went wrong');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [tab]);

  async function createResource(payload) {
    const endpoint = tab === 'departments' ? '/departments' : tab === 'designations' ? '/designations' : tab === 'locations' ? '/orgs/locations' : tab === 'shifts' ? '/attendance/shifts' : '/calendars';
    try { const { data } = await apiClient.post(endpoint, payload); setRows((current) => [...current, data.data]); setDrawer(null); pushInfo('HR setting created'); } catch (err) { pushError(apiErrorMessage(err, 'Failed to create HR setting'), 'Something went wrong'); }
  }

  async function openHolidays(calendar) {
    setHolidayCalendar(calendar);
    try { const { data } = await apiClient.get(`/calendars/${calendar.id}/holidays`); setHolidays(data.data || []); } catch (err) { pushError(apiErrorMessage(err, 'Failed to load holidays'), 'Something went wrong'); }
  }

  async function addHoliday(payload) {
    try { const { data } = await apiClient.post(`/calendars/${holidayCalendar.id}/holidays`, payload); setHolidays((current) => [...current, data.data]); pushInfo('Holiday added'); } catch (err) { pushError(apiErrorMessage(err, 'Failed to add holiday'), 'Something went wrong'); }
  }

  const canManage = user?.role === 'admin';
  const names = { departments: 'department', designations: 'designation' };
  const columns = tab === 'departments' || tab === 'designations' ? [{ key: 'name', header: 'Name' }, { key: 'created', header: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() }] : tab === 'locations' ? [{ key: 'name', header: 'Location' }, { key: 'city', header: 'City', render: (row) => row.city || 'Not set' }, { key: 'country', header: 'Country', render: (row) => row.country || 'Not set' }, { key: 'default', header: 'Default', render: (row) => row.is_default ? 'Yes' : 'No' }] : tab === 'shifts' ? [{ key: 'name', header: 'Shift' }, { key: 'hours', header: 'Hours', render: (row) => `${minutesToTime(row.start_minutes)} - ${minutesToTime(row.end_minutes)}` }, { key: 'grace', header: 'Grace', render: (row) => `${row.grace_minutes}m` }] : [{ key: 'name', header: 'Calendar' }, { key: 'kind', header: 'Kind', render: (row) => <span className="capitalize">{row.kind}</span> }, { key: 'holidays', header: 'Holidays', render: (row) => row._count?.holidays ?? 0 }, { key: 'actions', header: 'Actions', render: (row) => <button type="button" className="btn-ghost" onClick={(event) => { event.stopPropagation(); openHolidays(row); }}>Manage holidays</button> }];

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-1 border-b border-tertiary-200">{TABS.map(({ key, label, icon: Icon }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-tertiary-500'}`} onClick={() => setParams({ tab: key })}><Icon className="h-4 w-4" />{label}</button>)}</div>
    <div className="flex justify-end">{canManage && <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => setDrawer(tab)}><Plus className="h-4 w-4" /> Add {names[tab] || tab.slice(0, -1)}</button>}</div>
    {!loading && rows.length === 0 ? <EmptyState icon={Settings2} title={`No ${tab} configured`} description="Create the first setting when your organization is ready." action={canManage ? <button type="button" className="btn-secondary" onClick={() => setDrawer(tab)}>Add {names[tab] || tab.slice(0, -1)}</button> : null} /> : <DataTable columns={columns} rows={rows} loading={loading} emptyLabel={`No ${tab} configured`} />}
    <NameDrawer open={drawer === 'departments' || drawer === 'designations'} title={`Add ${names[tab] || 'setting'}`} onClose={() => setDrawer(null)} value="" onSubmit={(name) => createResource({ name })} />
    <LocationDrawer open={drawer === 'locations'} onClose={() => setDrawer(null)} onSubmit={createResource} />
    <ShiftDrawer open={drawer === 'shifts'} onClose={() => setDrawer(null)} onSubmit={createResource} />
    <CalendarDrawer open={drawer === 'calendars'} onClose={() => setDrawer(null)} onSubmit={createResource} />
    <HolidayDrawer open={Boolean(holidayCalendar)} calendar={holidayCalendar} onClose={() => setHolidayCalendar(null)} onSubmit={addHoliday} />
    {holidayCalendar && <div className="fixed inset-0 z-40 pointer-events-none"><div className="pointer-events-auto absolute bottom-4 left-4 max-w-sm rounded-2xl border border-tertiary-200 bg-white p-4 shadow-drawer"><h3 className="font-semibold text-tertiary-900">{holidayCalendar.name} holidays</h3>{holidays.length ? <ul className="mt-2 space-y-1 text-sm text-tertiary-600">{holidays.map((holiday) => <li key={holiday.id}>{new Date(`${holiday.date}T00:00:00`).toLocaleDateString()} - {holiday.label}</li>)}</ul> : <p className="mt-2 text-sm text-tertiary-500">No holidays configured.</p>}</div></div>}
  </div>;
}
