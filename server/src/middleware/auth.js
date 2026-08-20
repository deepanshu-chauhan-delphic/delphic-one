const jwt = require('jsonwebtoken');
const env = require('../config/env');
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

module.exports = { authenticate, authorize };
