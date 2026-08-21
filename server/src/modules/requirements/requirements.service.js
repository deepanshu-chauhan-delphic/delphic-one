const prisma = require('../../config/db');
const {
  REQUIREMENT_STATUS_TRANSITIONS,
  SEAT_STATUS_TRANSITIONS,
} = require('./stageMachines');

function serialize(row) {
  if (!row) return null;
  const { account_id, account, sales_owner_id, sales_owner, assignments, seats, ...rest } = row;

  const seats_total = row.seats_total;
  const seats_closed = seats ? seats.filter((s) => s.seat_status === 'closed').length : undefined;

  return {
    ...rest,
    account: account ? { id: account.id, name: account.name, type: account.type } : undefined,
    sales_owner: sales_owner ? { id: sales_owner.id, name: sales_owner.name } : undefined,
    assigned_recruiters: assignments
      ? assignments.map((a) => ({ id: a.user.id, name: a.user.name, assigned_at: a.assigned_at }))
      : undefined,
    seats_total,
    seats_closed,
  };
}

const DECORATE_INCLUDE = {
  account: { select: { id: true, name: true, type: true } },
  sales_owner: { select: { id: true, name: true } },
  assignments: {
    where: { role_on_req: 'recruiter', unassigned_at: null },
    include: { user: { select: { id: true, name: true } } },
  },
  seats: true,
};

async function list(filters) {
  const { status, req_type, account_id, sales_owner_id, recruiter_id, priority, tech_stack, search, sort_by, sort_order, page, limit } = filters;

  const where = {
    ...(status ? { status } : {}),
    ...(req_type ? { req_type } : {}),
    ...(account_id ? { account_id } : {}),
    ...(sales_owner_id ? { sales_owner_id } : {}),
    ...(priority ? { priority } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { designation: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(tech_stack
      ? {
          OR: [
            { primary_tech_stack: { hasSome: tech_stack.split(',').map((s) => s.trim()) } },
            { secondary_tech_stack: { hasSome: tech_stack.split(',').map((s) => s.trim()) } },
          ],
        }
      : {}),
    ...(recruiter_id
      ? { assignments: { some: { user_id: recruiter_id, role_on_req: 'recruiter', unassigned_at: null } } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.requirement.count({ where }),
    prisma.requirement.findMany({
      where,
      include: DECORATE_INCLUDE,
      orderBy: { [sort_by]: sort_order },
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  return { rows: rows.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await prisma.requirement.findUnique({ where: { id }, include: DECORATE_INCLUDE });
  return serialize(row);
}

function canMutateRequirement(requirement, user) {
  if (!requirement) return false;
  if (user.role === 'admin') return true;
  return user.role === 'sales' && requirement.sales_owner_id === user.id;
}

async function create(data, salesOwnerId) {
  const account = await prisma.account.findUnique({ where: { id: data.account_id } });
  if (!account || account.type !== 'client' || account.stage !== 'active') {
    return { error: 'invalid_account' };
  }

  const { seats_total = 1, ...rest } = data;

  const row = await prisma.requirement.create({
    data: {
      ...rest,
      seats_total,
      sales_owner_id: salesOwnerId,
      seats: {
        create: Array.from({ length: seats_total }, (_, i) => ({ seat_label: `Seat ${i + 1}` })),
      },
    },
    include: DECORATE_INCLUDE,
  });

  return { requirement: serialize(row) };
}

async function update(id, patch, user) {
  const existing = await prisma.requirement.findUnique({ where: { id } });
  if (!existing) return { error: 'not_found' };
  if (!canMutateRequirement(existing, user)) return { error: 'forbidden' };

  const row = await prisma.requirement.update({ where: { id }, data: patch, include: DECORATE_INCLUDE });
  return { requirement: serialize(row) };
}

async function changeStatus(id, { to_status, reason }, user) {
  return prisma.$transaction(async (tx) => {
    const requirement = await tx.requirement.findUnique({ where: { id } });
    if (!requirement) return { error: 'not_found' };
    if (!canMutateRequirement(requirement, user)) return { error: 'forbidden' };
    if (requirement.is_locked) return { error: 'locked' };
    if (!(REQUIREMENT_STATUS_TRANSITIONS[requirement.status] || []).includes(to_status)) return { error: 'invalid_transition' };
    if (to_status === 'dropped' && !reason) return { error: 'reason_required' };

    if (to_status === 'closed') {
      const openSeats = await tx.requirementSeat.count({
        where: { requirement_id: id, seat_status: { notIn: ['closed', 'dropped'] } },
      });
      if (openSeats > 0) return { error: 'seats_not_closed' };
    }

    const patch = { status: to_status };
    if (to_status === 'dropped') patch.is_locked = true;
    if (to_status === 'closed') {
      patch.is_locked = true;
      patch.closed_at = new Date();
    }

    const updated = await tx.requirement.update({ where: { id }, data: patch, include: DECORATE_INCLUDE });

    await tx.stageHistory.create({
      data: {
        entity_type: 'requirement',
        entity_id: id,
        from_stage: requirement.status,
        to_stage: to_status,
        changed_by: user.id,
        reason: reason || null,
      },
    });

    return { requirement: serialize(updated) };
  });
}

async function assign(requirementId, { user_id, role_on_req }, assignedByUser) {
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement) return { error: 'not_found' };
  if (!canMutateRequirement(requirement, assignedByUser)) return { error: 'forbidden' };

  const target = await prisma.user.findUnique({ where: { id: user_id } });
  if (!target) return { error: 'user_not_found' };
  if (target.role !== role_on_req) return { error: 'role_mismatch' };

  const existing = await prisma.requirementAssignment.findFirst({
    where: { requirement_id: requirementId, user_id, role_on_req, unassigned_at: null },
  });
  if (existing) return { error: 'already_assigned' };

  const row = await prisma.requirementAssignment.create({
    data: { requirement_id: requirementId, user_id, role_on_req, assigned_by: assignedByUser.id },
  });

  return {
    assignment: {
      id: row.id,
      user: { id: target.id, name: target.name, role: target.role },
      role_on_req: row.role_on_req,
      assigned_at: row.assigned_at,
      assigned_by: { id: assignedByUser.id },
    },
  };
}

async function unassign(requirementId, assignmentId, user) {
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement) return { error: 'not_found' };
  if (!canMutateRequirement(requirement, user)) return { error: 'forbidden' };

  const assignment = await prisma.requirementAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.requirement_id !== requirementId) return { error: 'not_found' };

  await prisma.requirementAssignment.update({ where: { id: assignmentId }, data: { unassigned_at: new Date() } });
  return { ok: true };
}

async function getAssignments(requirementId) {
  const rows = await prisma.requirementAssignment.findMany({
    where: { requirement_id: requirementId },
    include: {
      user: { select: { id: true, name: true, role: true } },
      assigned_by_user: { select: { id: true, name: true } },
    },
    orderBy: { assigned_at: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    user: r.user,
    role_on_req: r.role_on_req,
    assigned_at: r.assigned_at,
    unassigned_at: r.unassigned_at,
    assigned_by: r.assigned_by_user,
  }));
}

async function getHistory(id) {
  return prisma.stageHistory.findMany({ where: { entity_type: 'requirement', entity_id: id }, orderBy: { changed_at: 'asc' } });
}

async function getSeats(requirementId) {
  const seats = await prisma.requirementSeat.findMany({ where: { requirement_id: requirementId } });
  const seatIds = seats.map((s) => s.id);

  const [counts, activeCounts] = await Promise.all([
    seatIds.length
      ? prisma.submission.groupBy({ by: ['requirement_seat_id'], where: { requirement_seat_id: { in: seatIds } }, _count: { id: true } })
      : [],
    seatIds.length
      ? prisma.submission.groupBy({
          by: ['requirement_seat_id'],
          where: { requirement_seat_id: { in: seatIds }, stage: { notIn: ['rejected', 'backout'] } },
          _count: { id: true },
        })
      : [],
  ]);

  const countMap = new Map(counts.map((c) => [c.requirement_seat_id, c._count.id]));
  const activeMap = new Map(activeCounts.map((c) => [c.requirement_seat_id, c._count.id]));

  return seats.map((s) => ({
    ...s,
    submissions_count: countMap.get(s.id) || 0,
    active_submissions_count: activeMap.get(s.id) || 0,
  }));
}

async function addSeat(requirementId, { seat_label }, user) {
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement) return { error: 'not_found' };
  if (!canMutateRequirement(requirement, user)) return { error: 'forbidden' };

  return prisma.$transaction(async (tx) => {
    const seat = await tx.requirementSeat.create({ data: { requirement_id: requirementId, seat_label: seat_label || null } });
    await tx.requirement.update({ where: { id: requirementId }, data: { seats_total: { increment: 1 } } });
    return { seat };
  });
}

async function changeSeatStatus(seatId, { to_status, reason, joined_at }, userId) {
  return prisma.$transaction(async (tx) => {
    const seat = await tx.requirementSeat.findUnique({ where: { id: seatId } });
    if (!seat) return { error: 'not_found' };
    if (seat.is_locked) return { error: 'locked' };
    if (!(SEAT_STATUS_TRANSITIONS[seat.seat_status] || []).includes(to_status)) return { error: 'invalid_transition' };
    if (to_status === 'dropped' && !reason) return { error: 'reason_required' };
    if (to_status === 'closed' && !joined_at) return { error: 'joined_at_required' };

    const patch = { seat_status: to_status };
    if (to_status === 'closed') {
      patch.is_locked = true;
      patch.closed_at = new Date();
      patch.joined_at = new Date(joined_at);
    }
    if (to_status === 'dropped') {
      patch.is_locked = true;
      patch.closed_at = new Date();
    }

    const updated = await tx.requirementSeat.update({ where: { id: seatId }, data: patch });

    await tx.stageHistory.create({
      data: {
        entity_type: 'seat',
        entity_id: seatId,
        from_stage: seat.seat_status,
        to_stage: to_status,
        changed_by: userId,
        reason: reason || null,
      },
    });

    const remainingOpen = await tx.requirementSeat.count({
      where: { requirement_id: seat.requirement_id, seat_status: { notIn: ['closed', 'dropped'] } },
    });
    if (remainingOpen === 0) {
      const req = await tx.requirement.findUnique({ where: { id: seat.requirement_id } });
      if (req && !['closed', 'dropped'].includes(req.status)) {
        await tx.requirement.update({
          where: { id: seat.requirement_id },
          data: { status: 'closed', is_locked: true, closed_at: new Date() },
        });
      }
    }

    return { seat: updated };
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  changeStatus,
  assign,
  unassign,
  getAssignments,
  getHistory,
  getSeats,
  addSeat,
  changeSeatStatus,
  canMutateRequirement,
};
