const { z } = require('zod');

const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  is_default: z.boolean().default(false),
});

// Admin sets an employee's directory/reporting fields — all optional, patch
// semantics. `null` clears a field (e.g. removing a manager).
const updateMembershipSchema = z.object({
  location_id: z.string().uuid().nullable().optional(),
  shift_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  hr_poc_id: z.string().uuid().nullable().optional(),
  sourcing_poc_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  designation_id: z.string().uuid().nullable().optional(),
});

module.exports = { createLocationSchema, updateMembershipSchema };
