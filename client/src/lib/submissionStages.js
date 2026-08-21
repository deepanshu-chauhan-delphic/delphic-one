/** Keep in sync with server/src/modules/submissions/stageMachines.js */

export const SUBMISSION_STAGE_TRANSITIONS = {
  sourced: ['internal_screening', 'rejected', 'backout'],
  internal_screening: ['submitted_to_client', 'rejected', 'backout'],
  submitted_to_client: ['interview_scheduled', 'rejected', 'backout'],
  interview_scheduled: ['interview_result', 'rejected', 'backout'],
  interview_result: ['offer', 'rejected', 'backout'],
  offer: ['bgv', 'backout', 'rejected'],
  bgv: ['closed', 'backout', 'rejected'],
  closed: [],
  backout: [],
  rejected: [],
};

export const SUBMISSION_PIPELINE = [
  'sourced',
  'internal_screening',
  'submitted_to_client',
  'interview_scheduled',
  'interview_result',
  'offer',
  'bgv',
  'closed',
];

export function nextSubmissionStages(stage) {
  return SUBMISSION_STAGE_TRANSITIONS[stage] || [];
}

export function requiresBackoutReason(toStage) {
  return toStage === 'backout';
}

export function requiresRejectionReason(toStage) {
  return toStage === 'rejected';
}

export function computeMarginPreview(proposed_rate, proposed_rate_currency, vendor_rate, vendor_rate_currency) {
  if (proposed_rate == null || proposed_rate === '' || vendor_rate == null || vendor_rate === '') {
    return { margin: null, margin_percentage: null };
  }
  if (proposed_rate_currency && vendor_rate_currency && proposed_rate_currency !== vendor_rate_currency) {
    return { margin: null, margin_percentage: null };
  }
  const proposed = Number(proposed_rate);
  const vendor = Number(vendor_rate);
  if (!Number.isFinite(proposed) || !Number.isFinite(vendor)) {
    return { margin: null, margin_percentage: null };
  }
  const margin = proposed - vendor;
  const margin_percentage = proposed ? Number(((margin / proposed) * 100).toFixed(2)) : null;
  return { margin, margin_percentage };
}

export function canCreateSubmission(user) {
  return user && ['recruiter', 'admin'].includes(user.role);
}

export function canMutateSubmission(user) {
  return user && ['recruiter', 'admin'].includes(user.role);
}

export function pipelineIndex(stage) {
  if (stage === 'backout' || stage === 'rejected') return -1;
  return SUBMISSION_PIPELINE.indexOf(stage);
}
