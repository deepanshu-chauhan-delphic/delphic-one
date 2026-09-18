const express = require('express');
const { authenticate, authorize, requireOrgMembership } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./leave.service');
const {
  createLeaveTypeSchema,
  createLeaveRequestSchema,
  decisionSchema,
  balanceQuerySchema,
  listRequestsQuerySchema,
} = require('./leave.validation');

const router = express.Router();
router.use(authenticate, requireOrgMembership);

router.get(
  '/types',
  asyncHandler(async (req, res) => {
    const rows = await service.listTypes(req.user.org_id);
    return ok(res, rows);
  })
);

router.get(
  '/balances/me',
  asyncHandler(async (req, res) => {
    const { year } = balanceQuerySchema.parse(req.query);
    const rows = await service.listMyBalances(req.user.org_id, req.user.org_membership_id, year);
    return ok(res, rows);
  })
);

router.post(
  '/types',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = createLeaveTypeSchema.parse(req.body);
    const result = await service.createType(req.user.org_id, body);
    if (result.error === 'name_taken') return fail(res, 409, 'Leave type name already in use');
    return created(res, result.leaveType);
  })
);

router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const body = createLeaveRequestSchema.parse(req.body);
    const result = await service.createRequest(req.user.org_id, req.user.org_membership_id, body);
    if (result.error === 'leave_type_not_found') return fail(res, 404, 'Leave type not found');
    return created(res, result.request);
  })
);

router.get(
  '/requests/me',
  asyncHandler(async (req, res) => {
    const query = listRequestsQuerySchema.omit({ org_membership_id: true, from: true, to: true }).parse(req.query);
    const result = await service.listMine(req.user.org_id, req.user.org_membership_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.get(
  '/requests',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listRequestsQuerySchema.parse(req.query);
    const result = await service.listTeam(req.user.org_id, query);
    return ok(res, result.data, { pagination: result.pagination });
  })
);

router.post(
  '/requests/:id/decision',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = decisionSchema.parse(req.body);
    const result = await service.decide(req.user.org_id, req.params.id, req.user.org_membership_id, body);
    if (result.error === 'not_found') return fail(res, 404, 'Leave request not found');
    if (result.error === 'not_pending') return fail(res, 409, 'Leave request is not pending');
    return ok(res, result.request);
  })
);

router.post(
  '/requests/:id/cancel',
  asyncHandler(async (req, res) => {
    const result = await service.cancel(req.user.org_id, req.user.org_membership_id, req.params.id);
    if (result.error === 'not_found') return fail(res, 404, 'Leave request not found');
    if (result.error === 'not_pending') return fail(res, 409, 'Leave request is not pending');
    return ok(res, result.request);
  })
);

module.exports = router;
