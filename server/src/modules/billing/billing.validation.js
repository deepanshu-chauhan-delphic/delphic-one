const { z } = require('zod');
const { requiredDate, optionalDate } = require('../../lib/zodDate');

const CURRENCY = z.enum(['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP']);

const createRateSchema = z.object({
  account_id: z.string().uuid(),
  requirement_id: z.string().uuid().optional(),
  rate_type: z.enum(['hourly', 'monthly']),
  rate: z.coerce.number().positive(),
  currency: CURRENCY.default('INR'),
  effective_from: requiredDate,
});

const listRatesQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  requirement_id: z.string().uuid().optional(),
});

// Always a range (a single day is date_from === date_to) — capped at 31 days
// so one call can't silently churn through months of history.
const computeDailyRevenueSchema = z
  .object({
    date_from: requiredDate,
    date_to: requiredDate,
  })
  .refine((v) => v.date_to >= v.date_from, { message: 'date_to must be on or after date_from', path: ['date_to'] })
  .refine((v) => (v.date_to - v.date_from) / 86400000 <= 30, { message: 'range cannot exceed 31 days', path: ['date_to'] });

const listDailyRevenueQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  requirement_id: z.string().uuid().optional(),
  from: optionalDate,
  to: optionalDate,
});

const createInvoiceSchema = z.object({
  client_account_id: z.string().uuid(),
  period_month: z.coerce.number().int().min(1).max(12),
  period_year: z.coerce.number().int().min(2000).max(2100),
});

const listInvoicesQuerySchema = z.object({
  client_account_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'sent', 'paid']).optional(),
});

const transitionInvoiceSchema = z.object({
  status: z.enum(['sent', 'paid']),
});

const createGroupChargeSchema = z.object({
  org_id: z.string().uuid(),
  period_month: z.coerce.number().int().min(1).max(12),
  period_year: z.coerce.number().int().min(2000).max(2100),
  kind: z.string().min(1).max(200),
  amount: z.coerce.number().positive(),
  currency: CURRENCY.default('INR'),
});

const listMyGroupChargesQuerySchema = z.object({
  period_month: z.coerce.number().int().min(1).max(12).optional(),
  period_year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const listAllGroupChargesQuerySchema = z.object({
  org_id: z.string().uuid().optional(),
});

module.exports = {
  createRateSchema,
  listRatesQuerySchema,
  computeDailyRevenueSchema,
  listDailyRevenueQuerySchema,
  createInvoiceSchema,
  listInvoicesQuerySchema,
  transitionInvoiceSchema,
  createGroupChargeSchema,
  listMyGroupChargesQuerySchema,
  listAllGroupChargesQuerySchema,
};
