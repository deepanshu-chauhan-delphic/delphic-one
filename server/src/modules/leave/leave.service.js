const prisma = require('../../config/db');

const DEFAULT_LEAVE_TYPES = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Casual Leave', paid: true, annual_quota: 12 },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Sick Leave', paid: true, annual_quota: 12 },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Earned Leave', paid: true, annual_quota: 18 },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Unpaid Leave', paid: false, annual_quota: 0 },
];

async function ensureDefaultTypes(orgId) {
  const existing = await prisma.leaveType.findMany({ where: { org_id: orgId }, select: { name: true } });
  const existingNames = new Set(existing.map((type) => type.name));
  const missing = DEFAULT_LEAVE_TYPES.filter((type) => !existingNames.has(type.name));
  if (missing.length === 0) return;

  for (const type of missing) {
    await prisma.leaveType.create({ data: { ...type, org_id: orgId } }).catch(() => undefined);
  }
}

async function listTypes(orgId) {
  await ensureDefaultTypes(orgId);
  return prisma.leaveType.findMany({ where: { org_id: orgId }, orderBy: { name: 'asc' } });
}

async function listMyBalances(orgId, orgMembershipId, year) {
  await ensureDefaultTypes(orgId);
  const leaveTypes = await prisma.leaveType.findMany({
    where: { org_id: orgId },
    orderBy: { name: 'asc' },
    include: {
      balances: {
        where: { org_membership_id: orgMembershipId, year },
        take: 1,
      },
    },
  });

  return leaveTypes.map((leaveType) => {
    const balance = leaveType.balances[0];
    const accrued = balance ? Number(balance.accrued) : 0;
    const allocated = accrued > 0 ? accrued : Number(leaveType.annual_quota || 0);
    const used = balance ? Number(balance.used) : 0;
    return {
      leave_type_id: leaveType.id,
      leave_type_name: leaveType.name,
      paid: leaveType.paid,
      year,
      allocated,
      accrued,
      used,
      remaining: Math.max(allocated - used, 0),
    };
  });
}

async function createType(orgId, { name, paid, annual_quota }) {
  const existing = await prisma.leaveType.findUnique({ where: { org_id_name: { org_id: orgId, name } } });
  if (existing) return { error: 'name_taken' };
  const leaveType = await prisma.leaveType.create({ data: { org_id: orgId, name, paid, annual_quota } });
  return { leaveType };
}

async function createRequest(
  orgId,
  orgMembershipId,
  { leave_type_id, from_date, to_date, is_half_day, half_day_session, reason }
) {
  const leaveType = await prisma.leaveType.findFirst({ where: { id: leave_type_id, org_id: orgId } });
  if (!leaveType) return { error: 'leave_type_not_found' };

  const request = await prisma.leaveRequest.create({
    data: {
      org_id: orgId,
      org_membership_id: orgMembershipId,
      leave_type_id,
      from_date,
      to_date,
      is_half_day,
      half_day_session: is_half_day ? half_day_session : null,
      reason,
    },
    include: { leave_type: true },
  });
  return { request };
}

async function listMine(orgId, orgMembershipId, { status, page, limit }) {
  const where = { org_id: orgId, org_membership_id: orgMembershipId, ...(status ? { status } : {}) };
  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { leave_type: true },
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

async function listTeam(orgId, { status, org_membership_id, from, to, page, limit }) {
  const where = {
    org_id: orgId,
    ...(status ? { status } : {}),
    ...(org_membership_id ? { org_membership_id } : {}),
    ...(from || to ? { from_date: { gte: from || undefined }, to_date: { lte: to || undefined } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        leave_type: true,
        org_membership: { select: { id: true, person: { select: { id: true, name: true } } } },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

async function decide(orgId, requestId, approverMembershipId, { status, reason }) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id: requestId, org_id: orgId } });
  if (!existing) return { error: 'not_found' };
  if (existing.status !== 'pending') return { error: 'not_pending' };

  const request = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status, approver_id: approverMembershipId, decided_at: new Date(), decision_reason: reason },
  });

  if (status === 'approved') {
    const days = request.is_half_day
      ? 0.5
      : Math.round((request.to_date - request.from_date) / 86400000) + 1;
    await prisma.leaveBalance.upsert({
      where: {
        org_membership_id_leave_type_id_year: {
          org_membership_id: request.org_membership_id,
          leave_type_id: request.leave_type_id,
          year: request.from_date.getUTCFullYear(),
        },
      },
      create: {
        org_membership_id: request.org_membership_id,
        leave_type_id: request.leave_type_id,
        year: request.from_date.getUTCFullYear(),
        used: days,
      },
      update: { used: { increment: days } },
    });
  }

  return { request };
}

async function cancel(orgId, orgMembershipId, requestId) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id: requestId, org_id: orgId, org_membership_id: orgMembershipId } });
  if (!existing) return { error: 'not_found' };
  if (existing.status !== 'pending') return { error: 'not_pending' };

  const request = await prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'cancelled' } });
  return { request };
}

module.exports = { listTypes, listMyBalances, createType, createRequest, listMine, listTeam, decide, cancel };
