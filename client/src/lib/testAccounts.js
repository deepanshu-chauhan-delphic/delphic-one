/**
 * Temporary test accounts for one-click login.
 * Replace with real SSO/auth before production — remove this module and LoginPage quick-login UI.
 * Password matches server/prisma/seed.js
 */
export const TEST_PASSWORD = 'Password123!';

export const QUICK_LOGIN_ACCOUNTS = [
  { role: 'admin', label: 'Admin 1', email: 'admin@delphic.local', name: 'Admin User' },
  { role: 'admin', label: 'Admin 2', email: 'admin2@delphic.local', name: 'Admin Two' },
  { role: 'bda', label: 'BDA 1', email: 'bda1@delphic.local', name: 'BDA One' },
  { role: 'bda', label: 'BDA 2', email: 'bda2@delphic.local', name: 'BDA Two' },
  { role: 'sales', label: 'Sales 1', email: 'sales1@delphic.local', name: 'Sales One' },
  { role: 'sales', label: 'Sales 2', email: 'sales2@delphic.local', name: 'Sales Two' },
  { role: 'recruiter', label: 'Recruiter 1', email: 'recruiter1@delphic.local', name: 'Recruiter One' },
  { role: 'recruiter', label: 'Recruiter 2', email: 'recruiter2@delphic.local', name: 'Recruiter Two' },
];

/** Show quick login whenever not explicitly disabled (testing default until real auth lands). */
export function isQuickLoginEnabled() {
  return import.meta.env.VITE_DISABLE_QUICK_LOGIN !== 'true';
}
