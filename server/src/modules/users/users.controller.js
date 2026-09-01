const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, fail } = require('../../utils/response');
const usersService = require('./users.service');
const { listQuerySchema, createSchema, updateSchema } = require('./users.validation');

const ERROR_STATUS = {
  email_taken: [409, 'Email already in use'],
};

const me = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.user.id);
  return ok(res, user);
});

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  // Sales may list users only to pick recruiters for assignment (RD-106). Keep scope narrow.
  // BDA needs the full roster to pick an account owner/POC, so no role clamp for them.
  if (req.user.role === 'sales') query.role = 'recruiter';
  const { rows, pagination } = await usersService.list(query);
  return ok(res, rows, { pagination });
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const result = await usersService.create(body);
  if (result.error) {
    const [status, message] = ERROR_STATUS[result.error];
    return fail(res, status, message);
  }
  return created(res, result.user);
});

const update = asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const result = await usersService.update(req.params.id, body);
  if (result.error) {
    const [status, message] = ERROR_STATUS[result.error];
    return fail(res, status, message);
  }
  return ok(res, result.user);
});

module.exports = { me, list, create, update };
