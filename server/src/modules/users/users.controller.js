const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const usersService = require('./users.service');
const { listQuerySchema, createSchema, updateSchema } = require('./users.validation');

const me = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.user.id);
  return ok(res, user);
});

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const { rows, pagination } = await usersService.list(query);
  return ok(res, rows, { pagination });
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const user = await usersService.create(body);
  return created(res, user);
});

const update = asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const user = await usersService.update(req.params.id, body);
  return ok(res, user);
});

module.exports = { me, list, create, update };
