const express = require('express');
const { authenticate, authorize, requireOrgMembership } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./timesheets.service');
const {
  createEntrySchema,
  updateEntrySchema,
  decideEntrySchema,
  lockDaySchema,
  listQuerySchema,
  createTicketSchema,
  decideTicketSchema,
} = require('./timesheets.validation');

const router = express.Router();
router.use(authenticate, requireOrgMembership);

const ENTRY_ERRORS = {
  day_locked: [409, 'That day is locked — raise a regularization ticket instead'],
  account_not_found: [404, 'Account not found'],
  requirement_not_found: [404, 'Requirement not found for that account'],
  exceeds_day_hours: [422, 'Total hours logged for that day would exceed 24'],
  not_found: [404, 'Timesheet entry not found'],
  already_decided: [409, 'Entry has already been approved or rejected'],
};

function failFor(res, error) {
  const mapped = ENTRY_ERRORS[error];
  return mapped ? fail(res, mapped[0], mapped[1]) : fail(res, 500, 'Unexpected error');
}

router.post(
  '/entries',
  asyncHandler(async (req, res) => {
    const body = createEntrySchema.parse(req.body);
    const result = await service.createEntry(req.user.org_id, req.user.org_membership_id, body);
    if (result.error) return failFor(res, result.error);
    return created(res, result.entry);
  })
);

router.get(
  '/entries/me',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.omit({ org_membership_id: true }).parse(req.query);
    const result = await service.listMine(req.user.org_membership_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.get(
  '/entries',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const result = await service.listTeam(req.user.org_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.patch(
  '/entries/:id',
  asyncHandler(async (req, res) => {
    const body = updateEntrySchema.parse(req.body);
    const result = await service.updateEntry(req.user.org_id, req.user.org_membership_id, req.params.id, body);
    if (result.error) return failFor(res, result.error);
    return ok(res, result.entry);
  })
);

router.post(
  '/entries/:id/decision',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = decideEntrySchema.parse(req.body);
    const result = await service.decideEntry(req.user.org_id, req.params.id, req.user.id, body);
    if (result.error) return failFor(res, result.error);
    return ok(res, result.entry);
  })
);

router.post(
  '/entries/:id/regularization-tickets',
  asyncHandler(async (req, res) => {
    const body = createTicketSchema.parse(req.body);
    const result = await service.createTicket(req.user.org_id, req.params.id, req.user.id, body);
    if (result.error === 'not_found') return fail(res, 404, 'Timesheet entry not found');
    if (result.error === 'not_locked') return fail(res, 422, "That day isn't locked — edit the entry directly instead");
    return created(res, result.ticket);
  })
);

router.get(
  '/regularization-tickets',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const rows = await service.listTickets(req.user.org_id, { status });
    return ok(res, rows);
  })
);

router.post(
  '/regularization-tickets/:id/decision',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = decideTicketSchema.parse(req.body);
    const result = await service.decideTicket(req.user.org_id, req.params.id, req.user.id, body);
    if (result.error === 'not_found') return fail(res, 404, 'Ticket not found');
    if (result.error === 'already_decided') return fail(res, 409, 'Ticket has already been decided');
    return ok(res, result.ticket);
  })
);

router.post(
  '/locks',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { date } = lockDaySchema.parse(req.body);
    const result = await service.lockDay(req.user.org_id, date, req.user.id);
    if (result.error === 'already_locked') return fail(res, 409, 'That day is already locked');
    return created(res, result.lock);
  })
);

router.get(
  '/locks',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const rows = await service.listLocks(req.user.org_id);
    return ok(res, rows);
  })
);

module.exports = router;
