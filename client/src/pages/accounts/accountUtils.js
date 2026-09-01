export const ACCOUNT_TRANSITIONS = {
  lead: ['meeting_scheduled'],
  meeting_scheduled: ['active', 'rescheduled', 'dropped'],
  rescheduled: ['meeting_scheduled', 'dropped'],
  active: ['dropped'],
  dropped: [],
};

// Every stage, for the superadmin override drawer (backward moves + straight to lead).
export const ACCOUNT_ALL_STAGES = ['lead', 'meeting_scheduled', 'active', 'rescheduled', 'dropped'];

export function canOverrideStage(user) {
  return Boolean(user?.is_superadmin);
}

export function canEditBroughtBy(user) {
  return Boolean(user?.is_superadmin);
}

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

export function canClassifyAccount(account, user) {
  return canMutateAccount(account, user) && account?.type == null;
}

export { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';
