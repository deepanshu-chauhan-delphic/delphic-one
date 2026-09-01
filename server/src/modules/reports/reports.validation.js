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

// Coverage-gap reports (clients without requirements, recruiter-vendor gaps) —
// present-state, no date range.
const coverageSchema = z.object({
  department_id: optionalUuid,
  bda_id: optionalUuid,
  recruiter_id: optionalUuid,
});

const closureSchema = dateRangeSchema.extend({
  group_by: z.enum(['month', 'quarter', 'client', 'recruiter']).optional(),
});

const boolFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

const explorerSchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  grain: z.enum(['requirement', 'submission']).optional(),
  account_id: optionalUuid,
  bda_id: optionalUuid,
  sales_id: optionalUuid,
  recruiter_id: optionalUuid,
  vendor_id: optionalUuid,
  department_id: optionalUuid,
  search: z.string().optional(),
  requirement_status: z.string().optional(),
  submission_stage: z.string().optional(),
  priority: z.string().optional(),
  stuck_only: boolFlag,
  past_sla_only: boolFlag,
  threshold_days: z.coerce.number().int().min(1).max(365).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

module.exports = { dateRangeSchema, agingSchema, closureSchema, explorerSchema, coverageSchema };
