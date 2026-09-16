const express = require('express');
const { authenticate, authorize, authorizeGroupSuperadmin, requireOrgMembership } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./billing.service');
const {
  createRateSchema,
  listRatesQuerySchema,
  computeDailyRevenueSchema,
  listDailyRevenueQuerySchema,
  createInvoiceSchema,
  listInvoicesQuerySchema,
  transitionInvoiceSchema,
  createGroupChargeSchema,
  listMyGroupChargesQuerySchema,
  listAllGroupChargesQuerySchema,
} = require('./billing.validation');

const router = express.Router();
router.use(authenticate);

const ERRORS = {
  account_not_found: [404, 'Account not found'],
  requirement_not_found: [404, 'Requirement not found for that account'],
  not_found: [404, 'Not found'],
  invoice_exists: [409, 'An invoice already exists for that client and period'],
  no_revenue_computed: [422, 'No daily revenue computed for that account/period yet — run compute first'],
  invalid_transition: [409, 'Invalid status transition'],
  org_not_found: [404, 'Org not found'],
};

function failFor(res, error) {
  const mapped = ERRORS[error];
  return mapped ? fail(res, mapped[0], mapped[1]) : fail(res, 500, 'Unexpected error');
}

router.post(
  '/rates',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = createRateSchema.parse(req.body);
    const result = await service.createRate(req.user.org_id, req.user.id, body);
    if (result.error) return failFor(res, result.error);
    return created(res, result.billingRate);
  })
);

router.get(
  '/rates',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listRatesQuerySchema.parse(req.query);
    const rows = await service.listRates(req.user.org_id, query);
    return ok(res, rows);
  })
);

router.post(
  '/daily-revenue/compute',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { date_from, date_to } = computeDailyRevenueSchema.parse(req.body);
    const result = await service.computeRevenueRange(req.user.org_id, date_from, date_to);
    return ok(res, result);
  })
);

router.get(
  '/daily-revenue',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listDailyRevenueQuerySchema.parse(req.query);
    const rows = await service.listDailyRevenue(req.user.org_id, query);
    return ok(res, rows);
  })
);

router.post(
  '/invoices',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = createInvoiceSchema.parse(req.body);
    const result = await service.createInvoice(req.user.org_id, req.user.id, body);
    if (result.error) return failFor(res, result.error);
    return created(res, result.invoice);
  })
);

router.get(
  '/invoices',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listInvoicesQuerySchema.parse(req.query);
    const rows = await service.listInvoices(req.user.org_id, query);
    return ok(res, rows);
  })
);

router.get(
  '/invoices/:id',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const result = await service.getInvoice(req.user.org_id, req.params.id);
    if (result.error) return failFor(res, result.error);
    return ok(res, result.invoice);
  })
);

router.post(
  '/invoices/:id/status',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { status } = transitionInvoiceSchema.parse(req.body);
    const result = await service.transitionInvoice(req.user.org_id, req.params.id, status);
    if (result.error) return failFor(res, result.error);
    return ok(res, result.invoice);
  })
);

router.post(
  '/group-charges',
  authorizeGroupSuperadmin,
  asyncHandler(async (req, res) => {
    const body = createGroupChargeSchema.parse(req.body);
    const result = await service.createGroupCharge(req.user.id, body);
    if (result.error) return failFor(res, result.error);
    return created(res, result.charge);
  })
);

router.get(
  '/group-charges',
  requireOrgMembership,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const query = listMyGroupChargesQuerySchema.parse(req.query);
    const rows = await service.listMyGroupCharges(req.user.org_id, query);
    return ok(res, rows);
  })
);

router.get(
  '/group-charges/all',
  authorizeGroupSuperadmin,
  asyncHandler(async (req, res) => {
    const query = listAllGroupChargesQuerySchema.parse(req.query);
    const rows = await service.listAllGroupCharges(query);
    return ok(res, rows);
  })
);

module.exports = router;
