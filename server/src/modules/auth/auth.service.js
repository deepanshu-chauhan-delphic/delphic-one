const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const env = require('../../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });
}

async function login(email, password) {
  const user = await db('users').where({ email }).first();
  if (!user || !user.active) return null;

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return null;

  return {
    access_token: signAccessToken(user),
    refresh_token: signRefreshToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active },
  };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    return null;
  }

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user || !user.active) return null;

  return {
    access_token: signAccessToken(user),
    refresh_token: signRefreshToken(user),
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) return { ok: false, reason: 'not_found' };

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) return { ok: false, reason: 'invalid_current' };

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: userId }).update({ password_hash, updated_at: db.fn.now() });
  return { ok: true };
}

module.exports = { login, refresh, changePassword };
