const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/response');
const service = require('./comments.service');
const { createSchema, listQuerySchema } = require('./comments.validation');

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const rows = await service.list(query);
  return ok(res, rows);
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const row = await service.create(body, req.user.id);
  return created(res, row);
});

module.exports = { list, create };
