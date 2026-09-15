const prisma = require('../../config/db');
const { todayIst } = require('../../lib/istDate');

async function checkIn(orgId, orgMembershipId) {
  const date = todayIst();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { org_membership_id_date: { org_membership_id: orgMembershipId, date } },
  });
  if (existing?.check_in_at) return { error: 'already_checked_in', record: existing };

  const record = existing
    ? await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { check_in_at: new Date(), status: 'present', source: 'web' },
      })
    : await prisma.attendanceRecord.create({
        data: { org_id: orgId, org_membership_id: orgMembershipId, date, check_in_at: new Date(), status: 'present', source: 'web' },
      });
  return { record };
}

async function checkOut(orgMembershipId) {
  const date = todayIst();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { org_membership_id_date: { org_membership_id: orgMembershipId, date } },
  });
  if (!existing || !existing.check_in_at) return { error: 'not_checked_in' };
  if (existing.check_out_at) return { error: 'already_checked_out', record: existing };

  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: { check_out_at: new Date() },
  });
  return { record };
}

function dateRangeWhere({ from, to }) {
  if (!from && !to) return undefined;
  return { gte: from || undefined, lte: to || undefined };
}

async function listMine(orgMembershipId, { from, to, page, limit }) {
  const date = dateRangeWhere({ from, to });
  const where = { org_membership_id: orgMembershipId, ...(date ? { date } : {}) };
  const [data, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

// Admin/team view — every membership in the org, or one via org_membership_id.
async function listTeam(orgId, { from, to, org_membership_id, page, limit }) {
  const date = dateRangeWhere({ from, to });
  const where = {
    org_id: orgId,
    ...(org_membership_id ? { org_membership_id } : {}),
    ...(date ? { date } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { org_membership: { select: { id: true, person: { select: { id: true, name: true } } } } },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

// Admin regularization — correct a record after the fact (forgot to check
// out, marked WFH, etc.). Always requires a reason, audited on the row itself
// (no separate history table yet — Phase 2 keeps this lean).
async function regularize(orgId, recordId, adminUserId, { status, check_in_at, check_out_at, reason }) {
  const existing = await prisma.attendanceRecord.findFirst({ where: { id: recordId, org_id: orgId } });
  if (!existing) return { error: 'not_found' };

  const record = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      status,
      ...(check_in_at ? { check_in_at: new Date(check_in_at) } : {}),
      ...(check_out_at ? { check_out_at: new Date(check_out_at) } : {}),
      regularized_by: adminUserId,
      regularized_reason: reason,
    },
  });
  return { record };
}

module.exports = { checkIn, checkOut, listMine, listTeam, regularize };
