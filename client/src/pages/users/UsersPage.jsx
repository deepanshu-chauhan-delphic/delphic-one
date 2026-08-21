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

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      apiClient
        .get('/departments')
        .then(({ data }) => setDepartments(data.data || []))
        .catch(() => setDepartments([]));
    }
  }, [user?.role]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

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
      { key: 'name', header: 'Name', render: (row) => row.name },
      { key: 'email', header: 'Email', render: (row) => <span className="font-mono text-tertiary-700">{row.email}</span> },
      { key: 'role', header: 'Role', render: (row) => <span className="capitalize">{row.role}</span> },
      { key: 'dept', header: 'Department', render: (row) => row.department?.name || 'Unassigned' },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className={row.active ? 'text-success-700' : 'text-tertiary-400'}>{row.active ? 'Active' : 'Inactive'}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) =>
          row.id !== user.id ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => toggleActive(row)}>
              {row.active ? 'Deactivate' : 'Activate'}
            </button>
          ) : (
            '—'
          ),
      },
    ],
    [user.id]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-tertiary-900">Users</h1>
          <p className="mt-1 text-sm text-tertiary-500">
            Only admins can create accounts. Assign a department so reports can filter by team.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
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

      <DataTable columns={columns} rows={rows} loading={loading} emptyLabel="No users yet." />

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
