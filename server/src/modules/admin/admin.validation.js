const { z } = require('zod');

const ENTITY_TYPES = ['account', 'requirement', 'seat', 'submission'];

const unlockParamsSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().uuid(),
});

const unlockBodySchema = z.object({
  reason: z.string().min(1),
});

module.exports = { ENTITY_TYPES, unlockParamsSchema, unlockBodySchema };
