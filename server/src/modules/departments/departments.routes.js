const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./departments.service');
const { createSchema, updateSchema } = require('./departments.validation');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  authorize('admin', 'sales'),
  asyncHandler(async (req, res) => {
    const rows = await service.list();
    return ok(res, rows);
  })
);

router.post(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const result = await service.create(body);
    if (result.error === 'name_taken') return fail(res, 409, 'Department name already in use');
    return created(res, result.department);
  })
);

router.patch(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const result = await service.update(req.params.id, body);
    if (result.error === 'name_taken') return fail(res, 409, 'Department name already in use');
    return ok(res, result.department);
  })
);

module.exports = router;
