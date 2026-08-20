const express = require('express');
const { z } = require('zod');
const { authenticate, authorize } = require('../../middleware/auth');
const { ok, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const db = require('../../config/db');

const ENTITY_TABLES = {
  account: 'accounts',
  requirement: 'requirements',
  seat: 'requirement_seats',
  submission: 'submissions',
};

const bodySchema = z.object({ reason: z.string().min(1) });

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.post(
  '/:entity_type/:entity_id/unlock',
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.params;
    const table = ENTITY_TABLES[entity_type];
    if (!table) return fail(res, 422, 'Invalid entity_type');

    const { reason } = bodySchema.parse(req.body);

    const result = await db.transaction(async (trx) => {
      const row = await trx(table).where({ id: entity_id }).first();
      if (!row) return { error: 'not_found' };
      if (!row.is_locked) return { error: 'not_locked' };

      await trx(table).where({ id: entity_id }).update({ is_locked: false });
      await trx('stage_history').insert({
        entity_type,
        entity_id,
        from_stage: null,
        to_stage: 'unlocked',
        changed_by: req.user.id,
        reason,
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
