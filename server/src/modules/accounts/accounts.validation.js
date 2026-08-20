const { z } = require('zod');

const contactSchema = z.object({
  name: z.string(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  designation: z.string().optional(),
  role_label: z.string().optional(),
});

const baseFields = {
  industry: z.string().optional(),
  company_size: z.enum(['startup', 'small', 'mid', 'enterprise']).optional(),
  website: z.string().optional(),
  location_city: z.string().optional(),
  location_country: z.string().optional(),
  gst_or_tax_id: z.string().optional(),

  poc_name: z.string().optional(),
  poc_email: z.string().email().optional().or(z.literal('')),
  poc_phone: z.string().optional(),
  poc_designation: z.string().optional(),

  additional_contacts: z.array(contactSchema).optional(),

  source: z.string().optional(),

  vendor_specializations: z.array(z.string()).optional(),
  vendor_rate_range: z.object({ min: z.number(), max: z.number(), currency: z.string() }).optional(),
  vendor_payment_terms: z.string().optional(),

  client_billing_currency: z.enum(['INR', 'USD', 'AED', 'SAR', 'EUR', 'GBP']).optional(),
  client_payment_terms: z.string().optional(),
};

const createSchema = z.object({
  type: z.enum(['client', 'vendor']),
  name: z.string().min(1),
  ...baseFields,
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  ...baseFields,
});

const stageSchema = z.object({
  to_stage: z.enum(['meeting_scheduled', 'active', 'rescheduled', 'dropped']),
  reason: z.string().optional(),
  meeting_mode: z.enum(['online', 'offline']).optional(),
  meeting_date: z.string().datetime().optional(),
});

const listQuerySchema = z.object({
  type: z.enum(['client', 'vendor']).optional(),
  stage: z.enum(['lead', 'meeting_scheduled', 'active', 'rescheduled', 'dropped']).optional(),
  owner_id: z.string().uuid().optional(),
  industry: z.string().optional(),
  search: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  sort_by: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createSchema, updateSchema, stageSchema, listQuerySchema };
