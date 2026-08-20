const { z } = require('zod');

const roleEnum = z.enum(['bda', 'sales', 'recruiter', 'admin']);

const listQuerySchema = z.object({
  role: roleEnum.optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: roleEnum,
  phone: z.string().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: roleEnum.optional(),
  phone: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

module.exports = { listQuerySchema, createSchema, updateSchema };
