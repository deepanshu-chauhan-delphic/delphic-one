import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient.js';
import { useAuth } from '../../lib/authContext.jsx';

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
};

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);

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
    if (user?.role === 'admin') loadUsers();
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
      };
      const { data } = await apiClient.post('/users', payload);
      setCreatedCreds({
        name: data.data.name,
        email: data.data.email,
        role: data.data.role,
        password: form.password,
      });
      setForm(emptyForm);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold text-tertiary-900">Users</h1>
        <p className="mt-1 text-sm text-tertiary-500">
          Only admins can create accounts. Share the email and password with each new BDA, Sales, Recruiter, or Admin —
          they sign in with those credentials.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {createdCreds && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-medium">User created — copy and share these credentials:</p>
          <p className="mt-1">
            {createdCreds.name} ({createdCreds.role}) — <span className="font-mono">{createdCreds.email}</span> /{' '}
            <span className="font-mono">{createdCreds.password}</span>
          </p>
        </div>
      )}

      <form onSubmit={handleCreate} className="max-w-xl space-y-3 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-medium text-tertiary-800">Create user</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Role</label>
            <select
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
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
              className="w-full rounded-md border px-3 py-2 text-sm"
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
              className="w-full rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="min 8 characters"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-tertiary-500">Phone (optional)</label>
            <input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? 'Creating…' : 'Create user'}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium text-tertiary-800">All users</div>
        {loading ? (
          <div className="p-4 text-sm text-tertiary-400">Loading…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-tertiary-50 text-tertiary-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-tertiary-900">{row.name}</td>
                  <td className="px-4 py-2 font-mono text-tertiary-700">{row.email}</td>
                  <td className="px-4 py-2 capitalize text-tertiary-700">{row.role}</td>
                  <td className="px-4 py-2">
                    <span className={row.active ? 'text-green-700' : 'text-tertiary-400'}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.id !== user.id && (
                      <button type="button" className="btn-secondary text-xs" onClick={() => toggleActive(row)}>
                        {row.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-tertiary-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
