const prisma = require('../../config/db');

function round2(n) {
  return Math.round(n * 100) / 100;
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function periodBounds(period_month, period_year) {
  const period_start = new Date(Date.UTC(period_year, period_month - 1, 1));
  const period_end = new Date(Date.UTC(period_year, period_month, 0));
  return { period_start, period_end };
}

async function createRate(orgId, createdByUserId, { account_id, requirement_id, rate_type, rate, currency, effective_from }) {
  const account = await prisma.account.findFirst({ where: { id: account_id, org_id: orgId } });
  if (!account) return { error: 'account_not_found' };
  if (requirement_id) {
    const requirement = await prisma.requirement.findFirst({ where: { id: requirement_id, account_id, org_id: orgId } });
    if (!requirement) return { error: 'requirement_not_found' };
  }

  const billingRate = await prisma.billingRate.create({
    data: { org_id: orgId, account_id, requirement_id, rate_type, rate, currency, effective_from, created_by: createdByUserId },
  });
  return { billingRate };
}

async function listRates(orgId, { account_id, requirement_id }) {
  return prisma.billingRate.findMany({
    where: { org_id: orgId, ...(account_id ? { account_id } : {}), ...(requirement_id ? { requirement_id } : {}) },
    orderBy: [{ account_id: 'asc' }, { effective_from: 'desc' }],
  });
}

// Most-specific-wins: a requirement-specific rate beats the account-wide
// default (requirement_id: null) when both apply on the given date.
async function resolveRate(orgId, accountId, requirementId, date) {
  if (requirementId) {
    const specific = await prisma.billingRate.findFirst({
      where: { org_id: orgId, account_id: accountId, requirement_id: requirementId, effective_from: { lte: date } },
      orderBy: { effective_from: 'desc' },
    });
    if (specific) return specific;
  }
  return prisma.billingRate.findFirst({
    where: { org_id: orgId, account_id: accountId, requirement_id: null, effective_from: { lte: date } },
    orderBy: { effective_from: 'desc' },
  });
}

// Computes/upserts DailyProjectRevenue for one day from that day's APPROVED
// + billable TimesheetEntry hours, grouped by (account_id, requirement_id).
// Idempotent — re-running a date updates the existing row instead of
// duplicating (see schema.prisma's DailyProjectRevenue comment for why this
// isn't a DB unique constraint).
async function computeDayRevenue(orgId, date) {
  const entries = await prisma.timesheetEntry.findMany({
    where: { org_id: orgId, date, status: 'approved', billable: true },
    select: { account_id: true, requirement_id: true, hours: true },
  });

  const grouped = new Map();
  for (const e of entries) {
    const key = `${e.account_id}|${e.requirement_id || ''}`;
    const bucket = grouped.get(key) || { account_id: e.account_id, requirement_id: e.requirement_id, hours: 0 };
    bucket.hours += Number(e.hours);
    grouped.set(key, bucket);
  }

  const computed = [];
  const skipped = [];

  for (const { account_id, requirement_id, hours } of grouped.values()) {
    const rateRow = await resolveRate(orgId, account_id, requirement_id, date);
    if (!rateRow) {
      skipped.push({ account_id, requirement_id, date: ymd(date), reason: 'no_billing_rate' });
      continue;
    }

    const revenue =
      rateRow.rate_type === 'hourly' ? round2(hours * Number(rateRow.rate)) : round2(Number(rateRow.rate) / daysInMonth(date));

    const existing = await prisma.dailyProjectRevenue.findFirst({
      where: { org_id: orgId, account_id, requirement_id: requirement_id ?? null, date },
    });
    const data = { org_id: orgId, account_id, requirement_id, date, billable_hours: hours, rate: rateRow.rate, revenue };
    const row = existing
      ? await prisma.dailyProjectRevenue.update({ where: { id: existing.id }, data })
      : await prisma.dailyProjectRevenue.create({ data });
    computed.push(row);
  }

  return { computed, skipped };
}

async function computeRevenueRange(orgId, dateFrom, dateTo) {
  const computed = [];
  const skipped = [];
  const days = Math.round((dateTo - dateFrom) / 86400000) + 1;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(dateFrom.getTime() + i * 86400000);
    const result = await computeDayRevenue(orgId, date);
    computed.push(...result.computed);
    skipped.push(...result.skipped);
  }
  return { computed_count: computed.length, skipped };
}

async function listDailyRevenue(orgId, { account_id, requirement_id, from, to }) {
  const date = from || to ? { gte: from || undefined, lte: to || undefined } : undefined;
  return prisma.dailyProjectRevenue.findMany({
    where: {
      org_id: orgId,
      ...(account_id ? { account_id } : {}),
      ...(requirement_id ? { requirement_id } : {}),
      ...(date ? { date } : {}),
    },
    orderBy: [{ date: 'desc' }],
    include: { account: { select: { id: true, name: true } }, requirement: { select: { id: true, title: true } } },
  });
}

async function createInvoice(orgId, createdByUserId, { client_account_id, period_month, period_year }) {
  const existing = await prisma.clientInvoice.findUnique({
    where: { client_account_id_period_month_period_year: { client_account_id, period_month, period_year } },
  });
  if (existing) return { error: 'invoice_exists', invoice: existing };

  const account = await prisma.account.findFirst({ where: { id: client_account_id, org_id: orgId } });
  if (!account) return { error: 'account_not_found' };

  const { period_start, period_end } = periodBounds(period_month, period_year);
  const rows = await prisma.dailyProjectRevenue.findMany({
    where: { org_id: orgId, account_id: client_account_id, date: { gte: period_start, lte: period_end } },
    include: { requirement: { select: { id: true, title: true } } },
  });
  if (!rows.length) return { error: 'no_revenue_computed' };

  const byRequirement = new Map();
  for (const row of rows) {
    const key = row.requirement_id || '__account_level__';
    const bucket = byRequirement.get(key) || {
      requirement_id: row.requirement_id,
      requirement_title: row.requirement?.title || null,
      hours: 0,
      revenue: 0,
    };
    bucket.hours += Number(row.billable_hours);
    bucket.revenue += Number(row.revenue);
    byRequirement.set(key, bucket);
  }
  const line_items = Array.from(byRequirement.values()).map((li) => ({ ...li, hours: round2(li.hours), revenue: round2(li.revenue) }));
  const amount = round2(line_items.reduce((sum, li) => sum + li.revenue, 0));

  const invoice = await prisma.clientInvoice.create({
    data: { org_id: orgId, client_account_id, period_month, period_year, amount, line_items, created_by: createdByUserId },
  });
  return { invoice };
}

async function listInvoices(orgId, { client_account_id, status }) {
  return prisma.clientInvoice.findMany({
    where: { org_id: orgId, ...(client_account_id ? { client_account_id } : {}), ...(status ? { status } : {}) },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    include: { client_account: { select: { id: true, name: true } } },
  });
}

async function getInvoice(orgId, invoiceId) {
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId, org_id: orgId },
    include: { client_account: { select: { id: true, name: true } } },
  });
  if (!invoice) return { error: 'not_found' };
  return { invoice };
}

// draft -> sent -> paid, forward only (see schema.prisma's ClientInvoice comment).
const FORWARD_TRANSITIONS = { draft: 'sent', sent: 'paid' };

async function transitionInvoice(orgId, invoiceId, status) {
  const invoice = await prisma.clientInvoice.findFirst({ where: { id: invoiceId, org_id: orgId } });
  if (!invoice) return { error: 'not_found' };
  if (FORWARD_TRANSITIONS[invoice.status] !== status) return { error: 'invalid_transition' };

  const data = { status };
  if (status === 'sent') data.sent_at = new Date();
  if (status === 'paid') data.paid_at = new Date();
  const updated = await prisma.clientInvoice.update({ where: { id: invoiceId }, data });
  return { invoice: updated };
}

async function createGroupCharge(raisedByUserId, { org_id, period_month, period_year, kind, amount, currency }) {
  const org = await prisma.org.findUnique({ where: { id: org_id } });
  if (!org) return { error: 'org_not_found' };

  const charge = await prisma.groupBillingCharge.create({
    data: { org_group_id: org.org_group_id, org_id, period_month, period_year, kind, amount, currency, raised_by: raisedByUserId },
  });
  return { charge };
}

async function listMyGroupCharges(orgId, { period_month, period_year }) {
  return prisma.groupBillingCharge.findMany({
    where: { org_id: orgId, ...(period_month ? { period_month } : {}), ...(period_year ? { period_year } : {}) },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
  });
}

async function listAllGroupCharges({ org_id }) {
  return prisma.groupBillingCharge.findMany({
    where: { ...(org_id ? { org_id } : {}) },
    orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    include: { org: { select: { id: true, name: true } } },
  });
}

module.exports = {
  createRate,
  listRates,
  resolveRate,
  computeDayRevenue,
  computeRevenueRange,
  listDailyRevenue,
  createInvoice,
  listInvoices,
  getInvoice,
  transitionInvoice,
  createGroupCharge,
  listMyGroupCharges,
  listAllGroupCharges,
};
