const asyncHandler = require('../../utils/asyncHandler');
const { ok, fail } = require('../../utils/response');
const service = require('./admin.service');
const { unlockParamsSchema, unlockBodySchema } = require('./admin.validation');

const ERROR_STATUS = {
  invalid_entity_type: [422, 'Invalid entity_type'],
  not_found: [404, 'Not found'],
  not_locked: [400, 'Record is not locked'],
};

const unlock = asyncHandler(async (req, res) => {
  const params = unlockParamsSchema.parse(req.params);
  const body = unlockBodySchema.parse(req.body);
  const result = await service.unlock(params.entity_type, params.entity_id, body.reason, req.user);
  if (result.error) {
    const [status, message] = ERROR_STATUS[result.error];
    return fail(res, status, message);
  }
  return ok(res, result.unlock, { message: 'Record unlocked' });
});

module.exports = { unlock };
