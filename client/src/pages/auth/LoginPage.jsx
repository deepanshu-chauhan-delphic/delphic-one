import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { QUICK_LOGIN_ACCOUNTS, TEST_PASSWORD, isQuickLoginEnabled } from '../../lib/testAccounts.js';
import PasswordInput from '../../components/ui/PasswordInput.jsx';

const BRAND_POINTS = [
  'Accounts → requirements → candidates → submissions in one pipeline',
  'Role-aware dashboards for BDA, Sales and Recruiters',
  'Interview calendar, reminders and in-app notifications',
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const { pushError } = useAlerts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickRole, setQuickRole] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function signIn(nextEmail, nextPassword) {
    setSubmitting(true);
    try {
      await login(nextEmail, nextPassword);
      navigate('/');
    } catch (err) {
      pushError(err.response?.data?.message || 'Login failed', 'Something went wrong');
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

  const inputClass =
    'w-full rounded-lg border border-tertiary-200 bg-white px-3 py-2.5 text-sm text-tertiary-900 shadow-soft transition placeholder:text-tertiary-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15';

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand / illustration panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden px-12 py-12 text-white lg:flex xl:px-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800" />
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-96 w-96 rounded-full bg-primary-900/40 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-sm">
            <img src="/Delphic_D-logo_transparent.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">Delphic one</span>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-sm">
            <img
              src="/undraw_dashboard_p93p.svg"
              alt="Illustration of a recruitment analytics dashboard"
              className="mx-auto w-full max-w-md"
            />
          </div>
        </div>

        <div className="relative space-y-4">
          <div>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight">
              Your requirement pipeline, end to end.
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/70">
              From first lead to joined candidate — one place for every team.
            </p>
          </div>
          <ul className="space-y-2.5">
            {BRAND_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-white/85">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Sign-in panel */}
      <main className="relative flex w-full flex-col items-center justify-center bg-gradient-to-b from-primary-50/60 to-white px-4 py-10 sm:px-6 lg:w-1/2 lg:bg-none lg:bg-white">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center text-center">
            <img src="/delphic-logo.png" alt="Delphic one" className="mb-2 h-12 object-contain lg:hidden" />
            <h1 className="font-heading text-2xl font-bold tracking-tight text-tertiary-900">Welcome back</h1>
            <p className="mt-1 text-sm text-tertiary-500">Sign in to Delphic one to continue</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-tertiary-100 bg-white shadow-card"
          >
            <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700" />
            <div className="space-y-4 p-7">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-tertiary-700">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@delphic.in"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-tertiary-700">Password</label>
                <PasswordInput
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-2.5 text-sm shadow-soft transition hover:shadow-cardHover"
              >
                {submitting && !quickRole ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          {isQuickLoginEnabled() && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
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
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-tertiary-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    {quickRole === account.email ? 'Signing in…' : account.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-tertiary-400">© {new Date().getFullYear()} Delphic · Delphic one</p>
        </div>
      </main>
    </div>
  );
}
