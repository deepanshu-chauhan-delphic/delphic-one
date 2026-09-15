const express = require('express');
const { authenticate, authorize, requireOrgMembership } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./calendars.service');
const { createCalendarSchema, addHolidaySchema, assignCalendarSchema } = require('./calendars.validation');

const router = express.Router();
router.use(authenticate, requireOrgMembership);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await service.list(req.user.org_id);
    return ok(res, rows);
  })
);

router.post(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = createCalendarSchema.parse(req.body);
    const calendar = await service.create(req.user.org_id, body);
    return created(res, calendar);
  })
);

router.get(
  '/:id/holidays',
  asyncHandler(async (req, res) => {
    const result = await service.listHolidays(req.user.org_id, req.params.id);
    if (result.error === 'not_found') return fail(res, 404, 'Calendar not found');
    return ok(res, result.holidays);
  })
);

router.post(
  '/:id/holidays',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = addHolidaySchema.parse(req.body);
    const result = await service.addHoliday(req.user.org_id, req.params.id, body);
    if (result.error === 'not_found') return fail(res, 404, 'Calendar not found');
    if (result.error === 'already_exists') return fail(res, 409, 'Holiday already exists on that date');
    return created(res, result.holiday);
  })
);

router.post(
  '/:id/assign',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { org_membership_id, account_id } = assignCalendarSchema.parse(req.body);
    const result = await service.assign(req.user.org_id, req.params.id, org_membership_id, account_id || null);
    if (result.error === 'calendar_not_found') return fail(res, 404, 'Calendar not found');
    if (result.error === 'membership_not_found') return fail(res, 404, 'Org membership not found');
    if (result.error === 'account_not_found') return fail(res, 404, 'Account not found');
    return ok(res, result.assignment);
  })
);

router.get(
  '/assignments/:orgMembershipId',
  asyncHandler(async (req, res) => {
    const rows = await service.listAssignments(req.user.org_id, req.params.orgMembershipId);
    return ok(res, rows);
  })
);

module.exports = router;
