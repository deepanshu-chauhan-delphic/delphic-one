const { z } = require('zod');
const { requiredDate, optionalDate } = require('../../lib/zodDate');

const createLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100),
  paid: z.boolean().default(true),
  annual_quota: z.coerce.number().int().min(0).optional(),
});

const createLeaveRequestSchema = z
  .object({
    leave_type_id: z.string().uuid(),
    from_date: requiredDate,
    to_date: requiredDate,
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.from_date <= v.to_date, { message: 'from_date must be on or before to_date', path: ['to_date'] });

const decisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

const listRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  org_membership_id: z.string().uuid().optional(),
  from: optionalDate,
  to: optionalDate,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createLeaveTypeSchema, createLeaveRequestSchema, decisionSchema, listRequestsQuerySchema };
