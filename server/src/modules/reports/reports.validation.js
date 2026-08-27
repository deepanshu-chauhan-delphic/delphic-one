const { z } = require('zod');

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.string().uuid().optional());

const dateRangeSchema = z.object({
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  department_id: optionalUuid,
  recruiter_id: optionalUuid,
  sales_id: optionalUuid,
  bda_id: optionalUuid,
  vendor_id: optionalUuid,
  client_id: optionalUuid,
});

const agingSchema = z.object({
  threshold_days: z.coerce.number().int().min(1).max(365).optional(),
  department_id: optionalUuid,
});

const closureSchema = dateRangeSchema.extend({
  group_by: z.enum(['month', 'quarter', 'client', 'recruiter']).optional(),
});

module.exports = { dateRangeSchema, agingSchema, closureSchema };
