const express = require('express');
const { authenticate, authorize, requireOrgMembership } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./attendance.service');
const { listQuerySchema, regularizeSchema } = require('./attendance.validation');

const router = express.Router();
router.use(authenticate, requireOrgMembership);

router.post(
  '/check-in',
  asyncHandler(async (req, res) => {
    const result = await service.checkIn(req.user.org_id, req.user.org_membership_id);
    if (result.error === 'already_checked_in') return fail(res, 409, 'Already checked in today');
    return created(res, result.record);
  })
);

router.post(
  '/check-out',
  asyncHandler(async (req, res) => {
    const result = await service.checkOut(req.user.org_membership_id);
    if (result.error === 'not_checked_in') return fail(res, 409, 'Not checked in today');
    if (result.error === 'already_checked_out') return fail(res, 409, 'Already checked out today');
    return ok(res, result.record);
  })
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.omit({ org_membership_id: true }).parse(req.query);
    const result = await service.listMine(req.user.org_membership_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.get(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const result = await service.listTeam(req.user.org_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.post(
  '/:id/regularize',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = regularizeSchema.parse(req.body);
    const result = await service.regularize(req.user.org_id, req.params.id, req.user.id, body);
    if (result.error === 'not_found') return fail(res, 404, 'Attendance record not found');
    return ok(res, result.record);
  })
);

module.exports = router;
