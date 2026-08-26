const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, fail } = require('../../utils/response');
const accountsService = require('./accounts.service');
const { createSchema, updateSchema, stageSchema, listQuerySchema } = require('./accounts.validation');

const ERROR_STATUS = {
  not_found: [404, 'Not found'],
  locked: [403, 'Record is locked'],
  forbidden: [403, 'You do not own this record'],
  invalid_transition: [400, 'Invalid stage transition'],
  reason_required: [400, 'reason is required for this transition'],
  meeting_fields_required: [400, 'meeting_mode and meeting_date are required'],
};

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  if (req.user.role === 'bda') query.owner_id = req.user.id;
  const { rows, pagination } = await accountsService.list(query);
  return ok(res, rows, { pagination });
});

const getOne = asyncHandler(async (req, res) => {
  const account = await accountsService.getById(req.params.id);
  if (!account) return fail(res, 404, 'Not found');
  if (req.user.role === 'bda' && account.owner?.id !== req.user.id) {
    return fail(res, 403, 'You do not own this record');
  }
  return ok(res, account);
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const account = await accountsService.create(body, req.user.id);
  return created(res, account);
});

const update = asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const result = await accountsService.update(req.params.id, body, req.user);
  if (result.error) {
    const [status, message] = ERROR_STATUS[result.error];
    return fail(res, status, message);
  }
  return ok(res, result.account);
});

const changeStage = asyncHandler(async (req, res) => {
  const body = stageSchema.parse(req.body);
  const result = await accountsService.changeStage(req.params.id, body, req.user);
  if (result.error) {
    const [status, message] = ERROR_STATUS[result.error];
    return fail(res, status, message);
  }
  return ok(res, result.account, { stage_history: result.history });
});

const history = asyncHandler(async (req, res) => {
  const account = await accountsService.getById(req.params.id);
  if (!account) return fail(res, 404, 'Not found');
  if (req.user.role === 'bda' && account.owner?.id !== req.user.id) {
    return fail(res, 403, 'You do not own this record');
  }
  const rows = await accountsService.getHistory(req.params.id);
  return ok(res, rows);
});

module.exports = { list, getOne, create, update, changeStage, history };
