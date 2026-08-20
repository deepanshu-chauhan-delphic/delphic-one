const express = require('express');
const { z } = require('zod');
const { authenticate, authorize } = require('../../middleware/auth');
const { ok, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const prisma = require('../../config/db');

const ENTITY_MODELS = {
  account: 'account',
  requirement: 'requirement',
  seat: 'requirementSeat',
  submission: 'submission',
};

const bodySchema = z.object({ reason: z.string().min(1) });

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.post(
  '/:entity_type/:entity_id/unlock',
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.params;
    const model = ENTITY_MODELS[entity_type];
    if (!model) return fail(res, 422, 'Invalid entity_type');

    const { reason } = bodySchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const row = await tx[model].findUnique({ where: { id: entity_id } });
      if (!row) return { error: 'not_found' };
      if (!row.is_locked) return { error: 'not_locked' };

      await tx[model].update({ where: { id: entity_id }, data: { is_locked: false } });
      await tx.stageHistory.create({
        data: {
          entity_type,
          entity_id,
          from_stage: null,
          to_stage: 'unlocked',
          changed_by: req.user.id,
          reason,
        },
      });

      return { ok: true };
    });

    if (result.error === 'not_found') return fail(res, 404, 'Not found');
    if (result.error === 'not_locked') return fail(res, 400, 'Record is not locked');

    return ok(res, { entity_type, entity_id, unlocked_by: { id: req.user.id, name: req.user.name }, reason }, {
      message: 'Record unlocked',
    });
  })
);

module.exports = router;
