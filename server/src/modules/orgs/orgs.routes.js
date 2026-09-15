const express = require('express');
const { authenticate, authorizeGroupSuperadmin } = require('../../middleware/auth');
const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./orgs.service');

const router = express.Router();
router.use(authenticate);

router.get(
  '/me/memberships',
  asyncHandler(async (req, res) => {
    const rows = await service.listMyMemberships(req.user.id);
    return ok(res, rows);
  })
);

router.get(
  '/',
  authorizeGroupSuperadmin,
  asyncHandler(async (req, res) => {
    const rows = await service.listOrgs();
    return ok(res, rows);
  })
);

module.exports = router;
