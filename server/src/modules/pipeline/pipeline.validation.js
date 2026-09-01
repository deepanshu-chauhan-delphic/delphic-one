const { z } = require('zod');

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.string().uuid().optional());

const boolFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

const boardQuerySchema = z.object({
  search: z.string().optional(),
  stuck: z.enum(['all', 'stuck', 'not_stuck']).optional(),
  past_sla_only: boolFlag,
  account_id: optionalUuid,
  bda_id: optionalUuid,
  sales_id: optionalUuid,
  recruiter_id: optionalUuid,
  status: z.string().optional(),
  priority: z.string().optional(),
  submission_stage: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

module.exports = { boardQuerySchema };
