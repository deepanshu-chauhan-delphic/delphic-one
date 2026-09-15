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
});

module.exports = { createCalendarSchema, addHolidaySchema, assignCalendarSchema };
