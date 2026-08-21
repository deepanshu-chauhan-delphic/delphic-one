export const ACCOUNT_TRANSITIONS = {
  lead: ['meeting_scheduled'],
  meeting_scheduled: ['active', 'rescheduled', 'dropped'],
  rescheduled: ['meeting_scheduled', 'dropped'],
  active: ['dropped'],
  dropped: [],
};

export function formatAccountValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/_/g, ' ');
}

export function accountKey(id) {
  return `ACC-${String(id || '').slice(0, 8).toUpperCase()}`;
}

export function canCreateAccount(user) {
  return user?.role === 'bda' || user?.role === 'admin';
}

export function canMutateAccount(account, user) {
  if (!account || !user) return false;
  return user.role === 'admin' || (user.role === 'bda' && account.owner?.id === user.id);
}

export function apiErrorMessage(error, fallback) {
  const response = error.response?.data;
  const validationMessage = response?.errors?.[0]?.message;
  return validationMessage || response?.message || fallback;
}
