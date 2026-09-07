/**
 * Parent-entity access checks for documents, comments, and history sub-routes.
 * Mirrors the ownership rules used on each entity's getOne handler.
 */

const prisma = require('../config/db');

/**
 * Accounts are readable and writable team-wide for notes/files.
 * Account field edits and stage moves stay role-gated in accounts.service.
 */
async function canAccessAccount(user, accountId) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) return { error: 'not_found' };
  return { ok: true };
}

async function canAccessRequirement(user, requirementId) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: {
      id: true,
      sales_owner_id: true,
      assignments: {
        where: { role_on_req: 'recruiter', unassigned_at: null },
        select: { user_id: true },
      },
    },
  });
  if (!requirement) return { error: 'not_found' };
  if (user.role === 'admin') return { ok: true };
  if (user.role === 'sales' && requirement.sales_owner_id !== user.id) return { error: 'forbidden' };
  if (user.role === 'recruiter') {
    const assigned = requirement.assignments.some((row) => row.user_id === user.id);
    if (!assigned) return { error: 'forbidden' };
  }
  return { ok: true };
}

async function canAccessProfile(user, profileId) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, added_by: true },
  });
  if (!profile) return { error: 'not_found' };
  // Profiles are shared across roles for staffing; any authenticated user may attach notes/files.
  return { ok: true };
}

async function canAccessSubmission(user, submissionId) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, submitted_by: true },
  });
  if (!submission) return { error: 'not_found' };
  if (user.role === 'admin') return { ok: true };
  if (user.role === 'recruiter' && submission.submitted_by !== user.id) return { error: 'forbidden' };
  return { ok: true };
}

const CHECKERS = {
  account: canAccessAccount,
  requirement: canAccessRequirement,
  profile: canAccessProfile,
  submission: canAccessSubmission,
};

/**
 * Return { ok: true } or { error: 'not_found' | 'forbidden' | 'bad_entity' }.
 * forWrite is accepted for call-site clarity; account access is open for both read and write.
 */
async function assertCanAccessEntity(user, entityType, entityId, _opts = {}) {
  const checker = CHECKERS[entityType];
  if (!checker) return { error: 'bad_entity' };
  return checker(user, entityId);
}

module.exports = {
  assertCanAccessEntity,
  canAccessAccount,
  canAccessRequirement,
  canAccessProfile,
  canAccessSubmission,
};
