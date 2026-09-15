const { z } = require('zod');
const { requiredDate } = require('../../lib/zodDate');

const createCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(['internal', 'client', 'custom']).default('internal'),
  is_default: z.boolean().default(false),
});

const addHolidaySchema = z.object({
  date: requiredDate,
  label: z.string().min(1).max(200),
});

const assignCalendarSchema = z.object({
  org_membership_id: z.string().uuid(),
  // Which client/project this mapping is for — omit for the employee's
  // default calendar. Client brief: multi-project calendar mapping.
  account_id: z.string().uuid().nullable().optional(),
});

module.exports = { createCalendarSchema, addHolidaySchema, assignCalendarSchema };
