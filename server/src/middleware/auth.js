const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');
const { fail } = require('../utils/response');

// Multi-company ERP (Phase 1): the JWT carries an `org_id` for users who have
// an OrgMembership (everyone, post Phase-0 backfill). Tokens issued before
// this shipped simply have no `org_id` claim — `payload.org_id` is undefined
// and everything below no-ops back to today's global-role behavior, so old
// tokens keep working until they expire/refresh.
//
// Role is then resolved *for that org*, live from the DB, mirroring the
// existing authorizeSuperadmin/loadSuperadminFlag pattern (re-read, never
// trust a JWT claim) — HLD §2. If the membership is missing or has since
// ended, this falls back to the JWT's role claim rather than failing the
// request: no route reads req.user.org_id / org_membership_id yet, so this
// is inert plumbing, not an access-control change.
async function resolveOrgContext(user, orgId) {
  if (!orgId) return user;
  const membership = await prisma.orgMembership.findUnique({
    where: { person_id_org_id: { person_id: user.id, org_id: orgId } },
    select: { id: true, role: true, employment_status: true },
  });
  if (!membership || membership.employment_status !== 'active') return user;
  return { ...user, role: membership.role, org_id: orgId, org_membership_id: membership.id };
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 401, 'Missing access token');

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    const base = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    resolveOrgContext(base, payload.org_id)
      .then((user) => {
        req.user = user;
        next();
      })
      .catch(next);
  } catch (err) {
    return fail(res, 401, 'Invalid or expired access token');
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, 'Not authenticated');
    if (!roles.includes(req.user.role)) return fail(res, 403, 'Insufficient role');
    return next();
  };
}

// Hard gate: 403 unless the caller is an active superadmin. The flag is always
// re-read from the DB (never trusted from the JWT), so a demoted superadmin loses
// access on the very next request.
async function authorizeSuperadmin(req, res, next) {
  try {
    if (!req.user) return fail(res, 401, 'Not authenticated');
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { is_superadmin: true, active: true },
    });
    if (!u || !u.active || !u.is_superadmin) return fail(res, 403, 'Superadmin only');
    req.user.is_superadmin = true;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Non-failing: resolves req.user.is_superadmin from the DB so shared routes
// (PATCH /users/:id, PATCH /accounts/:id) and lockCheck can branch on a verified flag.
async function loadSuperadminFlag(req, res, next) {
  try {
    if (!req.user) return next();
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { is_superadmin: true, active: true },
    });
    req.user.is_superadmin = Boolean(u && u.active && u.is_superadmin);
    return next();
  } catch (err) {
    return next(err);
  }
}

// Multi-company ERP (Phase 1): read access to the cross-org super dashboard
// only — a flag separate from any per-org `authorize('admin')` /
// `authorizeSuperadmin`, per HLD §2. Same re-read-from-DB pattern, never a
// JWT claim.
async function authorizeGroupSuperadmin(req, res, next) {
  try {
    if (!req.user) return fail(res, 401, 'Not authenticated');
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { is_group_superadmin: true, active: true },
    });
    if (!u || !u.active || !u.is_group_superadmin) return fail(res, 403, 'Group superadmin only');
    req.user.is_group_superadmin = true;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Multi-company ERP (Phase 2): the new ERP modules (calendars, attendance,
// leave, ...) are meaningless without an active org context, unlike the
// existing recruitment routes (which stay oblivious to org_id for now — see
// resolveOrgContext above). Gate them on req.user.org_membership_id instead
// of silently no-op'ing.
function requireOrgMembership(req, res, next) {
  if (!req.user) return fail(res, 401, 'Not authenticated');
  if (!req.user.org_membership_id) return fail(res, 403, 'No active org membership');
  return next();
}

module.exports = {
  authenticate,
  authorize,
  authorizeSuperadmin,
  loadSuperadminFlag,
  authorizeGroupSuperadmin,
  requireOrgMembership,
};
