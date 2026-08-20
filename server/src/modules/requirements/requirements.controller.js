const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, fail } = require('../../utils/response');
const service = require('./requirements.service');
const {
  createSchema,
  updateSchema,
  statusSchema,
  assignSchema,
  unassignSchema,
  seatCreateSchema,
  seatStageSchema,
  listQuerySchema,
} = require('./requirements.validation');

const ERROR_STATUS = {
  not_found: [404, 'Not found'],
  locked: [403, 'Record is locked'],
  invalid_transition: [400, 'Invalid status transition'],
  reason_required: [400, 'reason is required for this transition'],
  seats_not_closed: [400, 'All seats must be closed before closing the requirement'],
  invalid_account: [400, 'account_id must reference an active client'],
  user_not_found: [404, 'User not found'],
  role_mismatch: [400, 'Target user role does not match role_on_req'],
  already_assigned: [400, 'User already actively assigned with this role'],
  joined_at_required: [400, 'joined_at is required when closing a seat'],
};

function mapError(res, error) {
  const [status, message] = ERROR_STATUS[error] || [400, 'Bad request'];
  return fail(res, status, message);
}

const list = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  if (req.user.role === 'recruiter') query.recruiter_id = req.user.id;
  const { rows, pagination } = await service.list(query);
  return ok(res, rows, { pagination });
});

const getOne = asyncHandler(async (req, res) => {
  const requirement = await service.getById(req.params.id);
  if (!requirement) return fail(res, 404, 'Not found');
  return ok(res, requirement);
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const result = await service.create(body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return created(res, result.requirement);
});

const update = asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body);
  const requirement = await service.update(req.params.id, body);
  return ok(res, requirement);
});

const changeStatus = asyncHandler(async (req, res) => {
  const body = statusSchema.parse(req.body);
  const result = await service.changeStatus(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return ok(res, result.requirement);
});

const assign = asyncHandler(async (req, res) => {
  const body = assignSchema.parse(req.body);
  const result = await service.assign(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return created(res, result.assignment);
});

const unassign = asyncHandler(async (req, res) => {
  const body = unassignSchema.parse(req.body);
  await service.unassign(body.assignment_id);
  return ok(res, null, { message: 'Unassigned successfully' });
});

const assignments = asyncHandler(async (req, res) => {
  const rows = await service.getAssignments(req.params.id);
  return ok(res, rows);
});

const history = asyncHandler(async (req, res) => {
  const rows = await service.getHistory(req.params.id);
  return ok(res, rows);
});

const getSeats = asyncHandler(async (req, res) => {
  const rows = await service.getSeats(req.params.id);
  return ok(res, rows);
});

const addSeat = asyncHandler(async (req, res) => {
  const body = seatCreateSchema.parse(req.body);
  const seat = await service.addSeat(req.params.id, body);
  return created(res, seat);
});

const changeSeatStatus = asyncHandler(async (req, res) => {
  const body = seatStageSchema.parse(req.body);
  const result = await service.changeSeatStatus(req.params.id, body, req.user.id);
  if (result.error) return mapError(res, result.error);
  return ok(res, result.seat);
});

module.exports = {
  list,
  getOne,
  create,
  update,
  changeStatus,
  assign,
  unassign,
  assignments,
  history,
  getSeats,
  addSeat,
  changeSeatStatus,
};
