const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, fail } = require('../../utils/response');
const service = require('./documents.service');
const { createMetaSchema, listQuerySchema } = require('./documents.validation');

const ERROR_STATUS = {
  file_required: [422, 'file is required'],
  not_found: [404, 'Not found'],
  forbidden: [403, 'Not permitted'],
};

function mapError(res, error) {
  const [status, message] = ERROR_STATUS[error] || [400, 'Bad request'];
  return fail(res, status, message);
}

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const rows = await service.list(query);
  return ok(res, rows);
});

const create = asyncHandler(async (req, res) => {
  const meta = createMetaSchema.parse(req.body);
  const result = await service.create({ ...meta, file: req.file }, req.user.id);
  if (result.error) return mapError(res, result.error);
  return created(res, result.document);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id, req.user);
  if (result.error) return mapError(res, result.error);
  return ok(res, null, { message: 'Document deleted' });
});

module.exports = { list, create, remove };
