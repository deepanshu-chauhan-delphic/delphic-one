/** Quick-login buttons on /login (dev only). Matches server/prisma/team-roster.js */
export const QUICK_LOGIN_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'admin@delphic.in', name: 'Admin' },
  { role: 'bda', label: 'BDA', email: 'chahak.pandya@delphic.in', name: 'Chahak Pandya' },
  { role: 'sales', label: 'Sales', email: 'tanvi.saxena@delphic.in', name: 'Tanvi Saxena' },
  { role: 'recruiter', label: 'Recruiter', email: 'sarthak.solanki@delphic.in', name: 'Sarthak Solanki' },
];

export const DEFAULT_DEV_PASSWORD = 'Password123!';

/** @deprecated use DEFAULT_DEV_PASSWORD */
export const TEST_PASSWORD = DEFAULT_DEV_PASSWORD;

export function isQuickLoginEnabled() {
  return import.meta.env.VITE_DISABLE_QUICK_LOGIN !== 'true';
}
