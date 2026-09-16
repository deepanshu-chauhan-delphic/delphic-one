const { z } = require('zod');
const { requiredDate, optionalDate } = require('../../lib/zodDate');

const createEntrySchema = z.object({
  date: requiredDate,
  account_id: z.string().uuid(),
  requirement_id: z.string().uuid().optional(),
  hours: z.coerce.number().positive().max(24),
  billable: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

// Patch semantics — only while the entry is still 'submitted' and the day
// isn't locked (see timesheets.service.updateEntry). A locked day's change
// must go through a regularization ticket instead.
const updateEntrySchema = z.object({
  hours: z.coerce.number().positive().max(24).optional(),
  billable: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const decideEntrySchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
});

const lockDaySchema = z.object({
  date: requiredDate,
});

const listQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
  org_membership_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  status: z.enum(['submitted', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(31),
});

// Only these three fields may be requested/applied via a regularization
// ticket — never trusted as an arbitrary write (schema.prisma comment).
const requestedChangeSchema = z
  .object({
    hours: z.coerce.number().positive().max(24).optional(),
    billable: z.boolean().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'requested_change must set at least one field' });

const createTicketSchema = z.object({
  requested_change: requestedChangeSchema,
  reason: z.string().min(1).max(500),
});

const decideTicketSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decision_reason: z.string().max(500).optional(),
});

module.exports = {
  createEntrySchema,
  updateEntrySchema,
  decideEntrySchema,
  lockDaySchema,
  listQuerySchema,
  createTicketSchema,
  decideTicketSchema,
};
