const SUBMISSION_STAGE_TRANSITIONS = {
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

const SUBMISSION_PIPELINE = [
  'sourced',
  'internal_screening',
  'submitted_to_client',
  'interview_scheduled',
  'interview_result',
  'offer',
  'bgv',
  'closed',
];

function nextSubmissionStages(stage) {
  return SUBMISSION_STAGE_TRANSITIONS[stage] || [];
}

function requiresBackoutReason(toStage) {
  return toStage === 'backout';
}

function requiresRejectionReason(toStage) {
  return toStage === 'rejected';
}

function computeMargin(proposed_rate, proposed_rate_currency, vendor_rate, vendor_rate_currency) {
  if (proposed_rate == null || vendor_rate == null) return { margin: null, margin_percentage: null };
  if (proposed_rate_currency && vendor_rate_currency && proposed_rate_currency !== vendor_rate_currency) {
    return { margin: null, margin_percentage: null };
  }
  const margin = Number(proposed_rate) - Number(vendor_rate);
  const margin_percentage = proposed_rate ? Number(((margin / proposed_rate) * 100).toFixed(2)) : null;
  return { margin, margin_percentage };
}

module.exports = {
  SUBMISSION_STAGE_TRANSITIONS,
  SUBMISSION_PIPELINE,
  nextSubmissionStages,
  requiresBackoutReason,
  requiresRejectionReason,
  computeMargin,
};
