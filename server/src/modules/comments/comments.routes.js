const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const db = require('../../config/db');

const createSchema = z.object({
  entity_type: z.enum(['account', 'requirement', 'submission']),
  entity_id: z.string().uuid(),
  body: z.string().min(1),
});

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) return fail(res, 422, 'entity_type and entity_id are required');

    const rows = await db('comments as c')
      .join('users as u', 'u.id', 'c.user_id')
      .select('c.id', 'c.entity_type', 'c.entity_id', 'c.body', 'c.created_at', 'u.id as user_id', 'u.name as user_name', 'u.role as user_role')
      .where({ 'c.entity_type': entity_type, 'c.entity_id': entity_id })
      .orderBy('c.created_at', 'asc');

    return ok(
      res,
      rows.map((r) => ({
        id: r.id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        body: r.body,
        created_at: r.created_at,
        user: { id: r.user_id, name: r.user_name, role: r.user_role },
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const [row] = await db('comments').insert({ ...body, user_id: req.user.id }).returning('*');
    return created(res, { ...row, user: { id: req.user.id, name: req.user.name, role: req.user.role } });
  })
);

module.exports = router;
