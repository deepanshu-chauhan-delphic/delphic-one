import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext.jsx';
import { useAlerts } from '../../lib/alerts/alertContext.jsx';
import { QUICK_LOGIN_ACCOUNTS, TEST_PASSWORD, isQuickLoginEnabled } from '../../lib/testAccounts.js';
import PasswordInput from '../../components/ui/PasswordInput.jsx';

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
    'w-full rounded-xl border border-tertiary-200 bg-white px-3.5 py-3 text-sm text-tertiary-900 shadow-soft transition placeholder:text-tertiary-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15';

  return (
    <div className="login-page relative flex min-h-screen overflow-hidden">
      <div className="relative z-10 flex w-full flex-col lg:flex-row">
        {/* Brand column: owns the illustration */}
        <section className="relative flex min-h-[42vh] flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-[#0c2f58] px-6 pb-8 pt-10 text-white sm:min-h-[46vh] sm:px-10 lg:min-h-screen lg:max-w-[52%] lg:px-14 lg:py-12 xl:px-20">
          <div className="login-page__grain pointer-events-none absolute inset-0" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 70% 55% at 20% 15%, rgb(74 139 201 / 0.4), transparent 55%), radial-gradient(ellipse 55% 45% at 80% 90%, rgb(16 63 116 / 0.55), transparent 50%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 login-page__enter login-page__enter--1 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-soft sm:h-12 sm:w-12">
              <img src="/Delphic_D-logo_transparent.png" alt="" className="h-full w-full object-contain" />
            </span>
            <p className="font-login text-[1.65rem] font-semibold leading-none tracking-tight sm:text-3xl">
              Delphic one
            </p>
          </div>

          <div className="relative z-10 login-page__enter login-page__enter--2 mt-12 max-w-md space-y-2.5 sm:mt-14 lg:mt-16">
            <h1 className="font-login text-base font-medium leading-relaxed tracking-normal text-white/85 sm:text-lg">
              Your requirement pipeline, end to end.
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-white/55">
              From first lead to joined candidate in one place for every team.
            </p>
          </div>

          {/* Illustration stays inside brand column only */}
          <div
            className="pointer-events-none relative z-0 mt-2 hidden flex-1 items-end justify-center lg:flex"
            aria-hidden="true"
          >
            <img
              src="/undraw_dashboard_p93p.svg"
              alt=""
              className="login-page__visual w-full max-w-xl object-contain opacity-90 drop-shadow-sm"
            />
          </div>

          <p className="relative z-10 login-page__enter login-page__enter--3 mt-6 text-xs text-white/40 lg:mt-8">
            © {new Date().getFullYear()} Delphic · Delphic one
          </p>
        </section>

        {/* Sign-in: solid panel, no illustration behind it */}
        <main className="relative z-20 flex flex-1 items-center justify-center bg-canvas px-4 py-10 sm:px-8 lg:bg-white lg:px-12 xl:px-16">
          <div className="login-page__enter login-page__enter--2 w-full max-w-[400px] space-y-5">
            <div>
              <h2 className="font-login text-lg font-semibold tracking-tight text-tertiary-900 sm:text-xl">
                Sign in
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-tertiary-500">
                Use your Delphic email to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-tertiary-700">
                  Email
                </label>
                <input
                  id="login-email"
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
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-tertiary-700">
                  Password
                </label>
                <PasswordInput
                  id="login-password"
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
                className="btn-primary mt-1 w-full py-3 text-sm shadow-soft transition hover:shadow-card active:scale-[0.99]"
              >
                {submitting && !quickRole ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {isQuickLoginEnabled() && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Testing only · seeded roles
                </p>
                <p className="mb-3 text-[11px] leading-relaxed text-amber-700">
                  Password for all chips: <span className="font-mono font-medium">Password123!</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_LOGIN_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleQuickLogin(account)}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-left transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      {quickRole === account.email ? (
                        <span className="text-sm font-medium text-tertiary-800">Signing in…</span>
                      ) : (
                        <>
                          <span className="block text-sm font-medium text-tertiary-900">{account.label}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-tertiary-500">{account.name}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
