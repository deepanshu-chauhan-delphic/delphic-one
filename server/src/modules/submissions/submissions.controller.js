const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, fail } = require('../../utils/response');
const service = require('./submissions.service');
const {
  createSchema,
  updateSchema,
  stageSchema,
  listQuerySchema,
  interviewRoundCreateSchema,
  interviewRoundUpdateSchema,
} = require('./submissions.validation');

const ERROR_STATUS = {
  not_found: [404, 'Not found'],
  locked: [403, 'Record is locked'],
  seat_not_found: [404, 'Seat not found'],
  seat_locked: [403, 'Seat is locked'],
  profile_inactive: [400, 'Profile is not active'],
  vendor_rate_required: [400, 'vendor_rate is required for vendor-sourced profiles'],
  duplicate_submission: [400, 'An active submission already exists for this profile and seat'],
  invalid_transition: [400, 'Invalid stage transition'],
  backout_reason_required: [400, 'backout_reason is required'],
  rejection_reason_required: [400, 'rejection_reason is required'],
  rounds_not_resolved: [400, 'All interview rounds must have a result before advancing to offer'],
  bgv_not_cleared: [400, 'bgv_status must be cleared before closing'],
};

function mapError(res, error) {
  const [status, message] = ERROR_STATUS[error] || [400, 'Bad request'];
  return fail(res, status, message);
}

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const { rows, pagination } = await service.list(query);
  return ok(res, rows, { pagination });
});

const getOne = asyncHandler(async (req, res) => {
  const submission = await service.getById(req.params.id);
  if (!submission) return fail(res, 404, 'Not found');
  return ok(res, submission);
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const result = await service.create(body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return created(res, result.submission);
});

const update = asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const submission = await service.update(req.params.id, body);
  return ok(res, submission);
});

const changeStage = asyncHandler(async (req, res) => {
  const body = stageSchema.parse(req.body);
  const result = await service.changeStage(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return ok(res, result.submission);
});

const history = asyncHandler(async (req, res) => {
  const rows = await service.getHistory(req.params.id);
  return ok(res, rows);
});

const addRound = asyncHandler(async (req, res) => {
  const body = interviewRoundCreateSchema.parse(req.body);
  const result = await service.addInterviewRound(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return created(res, result.round);
});

const updateRound = asyncHandler(async (req, res) => {
  const body = interviewRoundUpdateSchema.parse(req.body);
  const result = await service.updateInterviewRound(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return ok(res, result.round);
});

const getRounds = asyncHandler(async (req, res) => {
  const rows = await service.getInterviewRounds(req.params.id);
  return ok(res, rows);
});

module.exports = { list, getOne, create, update, changeStage, history, addRound, updateRound, getRounds };
