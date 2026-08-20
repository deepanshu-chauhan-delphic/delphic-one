const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middleware/auth');
const { ok, created, fail } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const prisma = require('../../config/db');

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

    const rows = await prisma.comment.findMany({
      where: { entity_type, entity_id },
      orderBy: { created_at: 'asc' },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    return ok(res, rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const row = await prisma.comment.create({
      data: { ...body, user_id: req.user.id },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return created(res, row);
  })
);

module.exports = router;
