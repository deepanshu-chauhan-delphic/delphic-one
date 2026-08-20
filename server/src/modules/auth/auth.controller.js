const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/response');
const authService = require('./auth.service');
const { loginSchema, refreshSchema, changePasswordSchema } = require('./auth.validation');

const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  if (!result) return fail(res, 401, 'Invalid credentials');
  return ok(res, result);
});

const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refresh_token);
  if (!result) return fail(res, 401, 'Invalid or expired refresh token');
  return ok(res, result);
});

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  const result = await authService.changePassword(req.user.id, current_password, new_password);
  if (!result.ok) return fail(res, 400, 'Current password is incorrect');
  return ok(res, null, { message: 'Password changed' });
});

module.exports = { login, refresh, changePassword };
