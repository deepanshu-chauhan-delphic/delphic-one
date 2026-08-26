import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext.jsx';
import { QUICK_LOGIN_ACCOUNTS, TEST_PASSWORD, isQuickLoginEnabled } from '../../lib/testAccounts.js';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickRole, setQuickRole] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function signIn(nextEmail, nextPassword) {
    setError('');
    setSubmitting(true);
    try {
      await login(nextEmail, nextPassword);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
      setQuickRole('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await signIn(email, password);
  }

  async function handleQuickLogin(account) {
    setQuickRole(account.email);
    setEmail(account.email);
    setPassword(TEST_PASSWORD);
    await signIn(account.email, TEST_PASSWORD);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-tertiary-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="mb-1 font-heading text-xl font-semibold text-tertiary-900">Requirement Dashboard</h1>
          <p className="mb-6 text-sm text-tertiary-500">Sign in with credentials from your admin</p>

          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <label className="mb-1 block text-sm font-medium text-tertiary-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="you@delphic.local"
          />

          <label className="mb-1 block text-sm font-medium text-tertiary-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="••••••••"
          />

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting && !quickRole ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {isQuickLoginEnabled() && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Temporary — testing only</p>
            <p className="mb-3 text-xs text-amber-700">
              One-click login for seeded roles. Remove before real auth / production (`VITE_DISABLE_QUICK_LOGIN=true` hides this).
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LOGIN_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickLogin(account)}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-tertiary-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {quickRole === account.email ? 'Signing in…' : account.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
