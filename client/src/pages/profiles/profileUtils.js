export function profileKey(id) {
  return `PRF-${String(id || '').slice(0, 8).toUpperCase()}`;
}

export function formatProfileValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replace(/_/g, ' ');
}

export function canCreateProfile(user) {
  return user?.role === 'recruiter' || user?.role === 'admin';
}

export function canViewProfiles(user) {
  return user?.role === 'recruiter' || user?.role === 'sales' || user?.role === 'admin';
}

export function canEditProfile(user) {
  return user?.role === 'recruiter' || user?.role === 'admin';
}

export function canAssignRecruiters(user) {
  return user?.role === 'sales' || user?.role === 'admin';
}

export { apiErrorMessage } from '../../lib/alerts/apiErrorMessage.js';

export function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function joinCsv(values) {
  return Array.isArray(values) ? values.join(', ') : '';
}
