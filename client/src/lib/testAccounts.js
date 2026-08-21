/**
 * Temporary test accounts for one-click login.
 * Replace with real SSO/auth before production — remove this module and LoginPage quick-login UI.
 * Password matches server/prisma/seed.js
 */
export const TEST_PASSWORD = 'Password123!';

export const QUICK_LOGIN_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'admin@delphic.local', name: 'Admin User' },
  { role: 'bda', label: 'BDA', email: 'bda1@delphic.local', name: 'BDA One' },
  { role: 'sales', label: 'Sales', email: 'sales1@delphic.local', name: 'Sales One' },
  { role: 'recruiter', label: 'Recruiter', email: 'recruiter1@delphic.local', name: 'Recruiter One' },
];

/** Show quick login whenever not explicitly disabled (testing default until real auth lands). */
export function isQuickLoginEnabled() {
  return import.meta.env.VITE_DISABLE_QUICK_LOGIN !== 'true';
}
