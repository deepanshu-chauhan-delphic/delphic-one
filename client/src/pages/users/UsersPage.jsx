import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Drawer from '../../components/ui/Drawer.jsx';

const CREATABLE_ROLES = [
  { value: 'bda', label: 'BDA' },
  { value: 'sales', label: 'Sales' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'admin', label: 'Admin' },
];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'bda',
  phone: '',
  department_id: '',
};

function DepartmentDrawer({ open, department, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = Boolean(department);

  useEffect(() => {
    if (open) {
      setName(department?.name || '');
      setError('');
    }
  }, [open, department]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEditing) await apiClient.patch(`/departments/${department.id}`, { name: name.trim() });
      else await apiClient.post('/departments', { name: name.trim() });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} department`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      title={isEditing ? 'Edit department' : 'Add department'}
      onClose={onClose}
      size="sm"
      tone={isEditing ? 'edit' : 'create'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="department-form" className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add department'}
          </button>
        </>
      }
    >
      <form id="department-form" onSubmit={submit} className="space-y-3">
        {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
        <label className="block text-xs font-medium text-tertiary-500">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          />
        </label>
      </form>
    </Drawer>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deptDrawer, setDeptDrawer] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/users', { params: { limit: 100 } });
      setRows(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  function loadDepartments() {
    apiClient
      .get('/departments')
      .then(({ data }) => setDepartments(data.data || []))
      .catch(() => setDepartments([]));
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      loadDepartments();
    }
  }, [user?.role]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCreatedCreds(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || null,
        department_id: form.department_id || null,
      };
      const { data } = await apiClient.post('/users', payload);
      setCreatedCreds({
        name: data.data.name,
        email: data.data.email,
        role: data.data.role,
        password: form.password,
      });
      setForm(emptyForm);
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(row) {
    setError('');
    try {
      await apiClient.patch(`/users/${row.id}`, { active: !row.active });
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  }

  const columns = useMemo(
    () => [
      { key: 'name', header: 'Name', render: (row) => <span className="font-semibold text-tertiary-900">{row.name}</span> },
      { key: 'email', header: 'Email', render: (row) => <span className="text-tertiary-500">{row.email}</span> },
      { key: 'role', header: 'Role', render: (row) => <span className="capitalize text-tertiary-700">{row.role}</span> },
      { key: 'dept', header: 'Department', render: (row) => row.department?.name || <span className="text-tertiary-400">Unassigned</span> },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.active ? 'bg-green-50 text-green-700' : 'bg-tertiary-100 text-tertiary-600'
            }`}
          >
            {row.active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) =>
          row.id !== user.id ? (
            <button
              type="button"
              className="rounded-lg border border-[#0052FF] bg-white px-3 py-1 text-xs font-medium text-[#0052FF] transition-colors hover:bg-[#EEF4FF]"
              onClick={() => toggleActive(row)}
            >
              {row.active ? 'Deactivate' : 'Activate'}
            </button>
          ) : (
            <span className="text-tertiary-400">—</span>
          ),
      },
    ],
    [user.id]
  );

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" className="btn-primary shrink-0" onClick={() => setCreateOpen(true)}>
          + Create user
        </button>
      </div>

      {error && <div className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}

      {createdCreds && (
        <div className="rounded-2xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
          <p className="font-medium">User created — copy and share these credentials:</p>
          <p className="mt-1">
            {createdCreds.name} ({createdCreds.role}) — <span className="font-mono">{createdCreds.email}</span> /{' '}
            <span className="font-mono">{createdCreds.password}</span>
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyLabel="No users yet."
        headerClassName="bg-[#F5F7FF]"
      />

      <section className="overflow-hidden rounded-2xl border border-tertiary-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-tertiary-100 px-4 py-2.5">
          <h2 className="font-heading text-sm font-semibold text-tertiary-900">Departments</h2>
          <button
            type="button"
            className="rounded-lg border border-[#0052FF] bg-white px-3 py-1.5 text-xs font-semibold text-[#0052FF] transition-colors hover:bg-[#EEF4FF]"
            onClick={() => setDeptDrawer({})}
          >
            + Add department
          </button>
        </div>
        <ul className="divide-y divide-tertiary-100">
          {departments.map((dept) => (
            <li key={dept.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium text-tertiary-900">{dept.name}</span>
              <button
                type="button"
                className="text-xs font-medium text-primary-600 transition-colors hover:underline"
                onClick={() => setDeptDrawer(dept)}
              >
                Edit
              </button>
            </li>
          ))}
          {departments.length === 0 && <li className="px-4 py-5 text-sm text-tertiary-400">No departments yet.</li>}
        </ul>
      </section>

      <DepartmentDrawer
        open={Boolean(deptDrawer)}
        department={deptDrawer?.id ? deptDrawer : null}
        onClose={() => setDeptDrawer(null)}
        onSaved={() => {
          setDeptDrawer(null);
          loadDepartments();
        }}
      />

      <Drawer open={createOpen} title="Create user" onClose={() => setCreateOpen(false)} size="md" tone="create">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Role</label>
              <select
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Temporary password</label>
              <input
                type="text"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 font-mono text-sm"
                placeholder="min 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Department</label>
              <select
                value={form.department_id}
                onChange={(e) => updateField('department_id', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tertiary-500">Phone (optional)</label>
              <input
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
