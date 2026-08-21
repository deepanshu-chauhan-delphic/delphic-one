const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./dashboard.service');

const router = express.Router();
router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const data = await service.getSummary(req.user);
    return ok(res, data);
  })
);

module.exports = router;
