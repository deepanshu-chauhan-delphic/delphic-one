const prisma = require('../../config/db');

async function listTypes(orgId) {
  return prisma.leaveType.findMany({ where: { org_id: orgId }, orderBy: { name: 'asc' } });
}

async function createType(orgId, { name, paid, annual_quota }) {
  const existing = await prisma.leaveType.findUnique({ where: { org_id_name: { org_id: orgId, name } } });
  if (existing) return { error: 'name_taken' };
  const leaveType = await prisma.leaveType.create({ data: { org_id: orgId, name, paid, annual_quota } });
  return { leaveType };
}

async function createRequest(orgId, orgMembershipId, { leave_type_id, from_date, to_date, reason }) {
  const leaveType = await prisma.leaveType.findFirst({ where: { id: leave_type_id, org_id: orgId } });
  if (!leaveType) return { error: 'leave_type_not_found' };

  const request = await prisma.leaveRequest.create({
    data: { org_id: orgId, org_membership_id: orgMembershipId, leave_type_id, from_date, to_date, reason },
    include: { leave_type: true },
  });
  return { request };
}

async function listMine(orgMembershipId, { status, page, limit }) {
  const where = { org_membership_id: orgMembershipId, ...(status ? { status } : {}) };
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
    const days = Math.round((request.to_date - request.from_date) / 86400000) + 1;
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

async function cancel(orgMembershipId, requestId) {
  const existing = await prisma.leaveRequest.findFirst({ where: { id: requestId, org_membership_id: orgMembershipId } });
  if (!existing) return { error: 'not_found' };
  if (existing.status !== 'pending') return { error: 'not_pending' };

  const request = await prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'cancelled' } });
  return { request };
}

module.exports = { listTypes, createType, createRequest, listMine, listTeam, decide, cancel };
