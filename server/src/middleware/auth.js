const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');
const { fail } = require('../utils/response');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 401, 'Missing access token');

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    return next();
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

module.exports = { authenticate, authorize, authorizeSuperadmin, loadSuperadminFlag };
