const { z } = require('zod');
const { requiredDate } = require('../../lib/zodDate');

// `ctc` is MONTHLY gross throughout this module (see schema.prisma comment).
// `components` must sum to `ctc` within a paisa of rounding — caught here,
// not left for the payroll run to silently misreport.
const componentsSchema = z.record(z.string().min(1), z.coerce.number());

const createSalaryStructureSchema = z
  .object({
    org_membership_id: z.string().uuid(),
    effective_from: requiredDate,
    ctc: z.coerce.number().positive(),
    components: componentsSchema,
  })
  .refine(
    (v) => Math.abs(Object.values(v.components).reduce((sum, n) => sum + n, 0) - v.ctc) < 0.01,
    { message: 'components must sum to ctc', path: ['components'] }
  );

const listSalaryStructuresQuerySchema = z.object({
  org_membership_id: z.string().uuid().optional(),
});

const createRunSchema = z.object({
  period_month: z.coerce.number().int().min(1).max(12),
  period_year: z.coerce.number().int().min(2000).max(2100),
});

const listRunsQuerySchema = z.object({
  status: z.enum(['draft', 'processed']).optional(),
});

const listPayslipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

module.exports = {
  createSalaryStructureSchema,
  listSalaryStructuresQuerySchema,
  createRunSchema,
  listRunsQuerySchema,
  listPayslipsQuerySchema,
};
