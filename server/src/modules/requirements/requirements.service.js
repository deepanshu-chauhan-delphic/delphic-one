const db = require('../../config/db');

const STATUS_TRANSITIONS = {
  open: ['in_progress', 'on_hold', 'closed', 'dropped'],
  in_progress: ['on_hold', 'closed', 'dropped'],
  on_hold: ['open', 'in_progress', 'dropped'],
  closed: [],
  dropped: [],
};

const SEAT_TRANSITIONS = {
  open: ['interviewing', 'dropped'],
  interviewing: ['offer', 'dropped'],
  offer: ['bgv', 'dropped'],
  bgv: ['closed', 'dropped'],
  closed: [],
  dropped: [],
};

async function decorate(row) {
  if (!row) return null;
  const [account, salesOwner, recruiters, seats] = await Promise.all([
    db('accounts').select('id', 'name', 'type').where({ id: row.account_id }).first(),
    db('users').select('id', 'name').where({ id: row.sales_owner_id }).first(),
    db('requirement_assignments as ra')
      .join('users as u', 'u.id', 'ra.user_id')
      .select('u.id', 'u.name', 'ra.assigned_at')
      .where({ 'ra.requirement_id': row.id, 'ra.role_on_req': 'recruiter' })
      .whereNull('ra.unassigned_at'),
    db('requirement_seats').where({ requirement_id: row.id }),
  ]);

  const seats_closed = seats.filter((s) => s.seat_status === 'closed').length;
  const { account_id, sales_owner_id, ...rest } = row;

  return {
    ...rest,
    account,
    sales_owner: salesOwner,
    assigned_recruiters: recruiters,
    seats_total: row.seats_total,
    seats_closed,
  };
}

async function list(filters) {
  const { status, req_type, account_id, sales_owner_id, recruiter_id, priority, tech_stack, search, sort_by, sort_order, page, limit } = filters;
  const query = db('requirements');

  if (status) query.where({ status });
  if (req_type) query.where({ req_type });
  if (account_id) query.where({ account_id });
  if (sales_owner_id) query.where({ sales_owner_id });
  if (priority) query.where({ priority });
  if (search) {
    query.where((qb) => {
      qb.whereILike('title', `%${search}%`).orWhereILike('designation', `%${search}%`).orWhereILike('description', `%${search}%`);
    });
  }
  if (tech_stack) {
    const stacks = tech_stack.split(',').map((s) => s.trim());
    query.where((qb) => {
      qb.where('primary_tech_stack', '&&', stacks).orWhere('secondary_tech_stack', '&&', stacks);
    });
  }
  if (recruiter_id) {
    query.whereIn('id', function () {
      this.select('requirement_id')
        .from('requirement_assignments')
        .where({ user_id: recruiter_id, role_on_req: 'recruiter' })
        .whereNull('unassigned_at');
    });
  }

  const total = Number((await query.clone().count({ count: '*' }).first()).count);
  const rows = await query.orderBy(sort_by, sort_order).limit(limit).offset((page - 1) * limit);
  const decorated = await Promise.all(rows.map(decorate));

  return { rows: decorated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await db('requirements').where({ id }).first();
  return decorate(row);
}

async function create(data, salesOwnerId) {
  return db.transaction(async (trx) => {
    const account = await trx('accounts').where({ id: data.account_id }).first();
    if (!account || account.type !== 'client' || account.stage !== 'active') {
      return { error: 'invalid_account' };
    }

    const { seats_total = 1, ...rest } = data;
    const [row] = await trx('requirements')
      .insert({ ...rest, seats_total, sales_owner_id: salesOwnerId })
      .returning('*');

    const seatRows = Array.from({ length: seats_total }, (_, i) => ({
      requirement_id: row.id,
      seat_label: `Seat ${i + 1}`,
    }));
    await trx('requirement_seats').insert(seatRows);

    return { requirement: await decorate(row) };
  });
}

async function update(id, patch) {
  const [row] = await db('requirements').where({ id }).update({ ...patch, updated_at: db.fn.now() }).returning('*');
  return decorate(row);
}

async function changeStatus(id, { to_status, reason }, userId) {
  return db.transaction(async (trx) => {
    const requirement = await trx('requirements').where({ id }).first();
    if (!requirement) return { error: 'not_found' };
    if (requirement.is_locked) return { error: 'locked' };
    if (!(STATUS_TRANSITIONS[requirement.status] || []).includes(to_status)) return { error: 'invalid_transition' };
    if (to_status === 'dropped' && !reason) return { error: 'reason_required' };

    if (to_status === 'closed') {
      const openSeats = await trx('requirement_seats').where({ requirement_id: id }).whereNotIn('seat_status', ['closed', 'dropped']);
      if (openSeats.length > 0) return { error: 'seats_not_closed' };
    }

    const patch = { status: to_status, updated_at: trx.fn.now() };
    if (to_status === 'dropped') patch.is_locked = true;
    if (to_status === 'closed') {
      patch.is_locked = true;
      patch.closed_at = trx.fn.now();
    }

    const [updated] = await trx('requirements').where({ id }).update(patch).returning('*');

    await trx('stage_history').insert({
      entity_type: 'requirement',
      entity_id: id,
      from_stage: requirement.status,
      to_stage: to_status,
      changed_by: userId,
      reason: reason || null,
    });

    return { requirement: await decorate(updated) };
  });
}

async function assign(requirementId, { user_id, role_on_req }, assignedBy) {
  const target = await db('users').where({ id: user_id }).first();
  if (!target) return { error: 'user_not_found' };
  if (target.role !== role_on_req) return { error: 'role_mismatch' };

  const existing = await db('requirement_assignments')
    .where({ requirement_id: requirementId, user_id, role_on_req })
    .whereNull('unassigned_at')
    .first();
  if (existing) return { error: 'already_assigned' };

  const [row] = await db('requirement_assignments')
    .insert({ requirement_id: requirementId, user_id, role_on_req, assigned_by: assignedBy })
    .returning('*');

  return {
    assignment: {
      id: row.id,
      user: { id: target.id, name: target.name, role: target.role },
      role_on_req: row.role_on_req,
      assigned_at: row.assigned_at,
      assigned_by: { id: assignedBy },
    },
  };
}

async function unassign(assignmentId) {
  const [row] = await db('requirement_assignments')
    .where({ id: assignmentId })
    .update({ unassigned_at: db.fn.now() })
    .returning('*');
  return row;
}

async function getAssignments(requirementId) {
  const rows = await db('requirement_assignments as ra')
    .join('users as u', 'u.id', 'ra.user_id')
    .join('users as ab', 'ab.id', 'ra.assigned_by')
    .select(
      'ra.id',
      'u.id as user_id',
      'u.name as user_name',
      'u.role as user_role',
      'ra.role_on_req',
      'ra.assigned_at',
      'ra.unassigned_at',
      'ab.id as assigned_by_id',
      'ab.name as assigned_by_name'
    )
    .where({ 'ra.requirement_id': requirementId })
    .orderBy('ra.assigned_at', 'desc');

  return rows.map((r) => ({
    id: r.id,
    user: { id: r.user_id, name: r.user_name, role: r.user_role },
    role_on_req: r.role_on_req,
    assigned_at: r.assigned_at,
    unassigned_at: r.unassigned_at,
    assigned_by: { id: r.assigned_by_id, name: r.assigned_by_name },
  }));
}

async function getHistory(id) {
  const rows = await db('stage_history').where({ entity_type: 'requirement', entity_id: id }).orderBy('changed_at', 'asc');
  return rows;
}

async function getSeats(requirementId) {
  const seats = await db('requirement_seats').where({ requirement_id: requirementId });
  const seatIds = seats.map((s) => s.id);
  const counts = seatIds.length
    ? await db('submissions')
        .select('requirement_seat_id')
        .count({ total: '*' })
        .whereIn('requirement_seat_id', seatIds)
        .groupBy('requirement_seat_id')
    : [];
  const activeCounts = seatIds.length
    ? await db('submissions')
        .select('requirement_seat_id')
        .count({ total: '*' })
        .whereIn('requirement_seat_id', seatIds)
        .whereNotIn('stage', ['rejected', 'backout'])
        .groupBy('requirement_seat_id')
    : [];
  const countMap = new Map(counts.map((c) => [c.requirement_seat_id, Number(c.total)]));
  const activeMap = new Map(activeCounts.map((c) => [c.requirement_seat_id, Number(c.total)]));

  return seats.map((s) => ({
    ...s,
    submissions_count: countMap.get(s.id) || 0,
    active_submissions_count: activeMap.get(s.id) || 0,
  }));
}

async function addSeat(requirementId, { seat_label }) {
  return db.transaction(async (trx) => {
    const [seat] = await trx('requirement_seats').insert({ requirement_id: requirementId, seat_label: seat_label || null }).returning('*');
    await trx('requirements').where({ id: requirementId }).increment('seats_total', 1);
    return seat;
  });
}

async function changeSeatStatus(seatId, { to_status, reason, joined_at }, userId) {
  return db.transaction(async (trx) => {
    const seat = await trx('requirement_seats').where({ id: seatId }).first();
    if (!seat) return { error: 'not_found' };
    if (seat.is_locked) return { error: 'locked' };
    if (!(SEAT_TRANSITIONS[seat.seat_status] || []).includes(to_status)) return { error: 'invalid_transition' };
    if (to_status === 'dropped' && !reason) return { error: 'reason_required' };
    if (to_status === 'closed' && !joined_at) return { error: 'joined_at_required' };

    const patch = { seat_status: to_status };
    if (to_status === 'closed') {
      patch.is_locked = true;
      patch.closed_at = trx.fn.now();
      patch.joined_at = joined_at;
    }
    if (to_status === 'dropped') {
      patch.is_locked = true;
      patch.closed_at = trx.fn.now();
    }

    const [updated] = await trx('requirement_seats').where({ id: seatId }).update(patch).returning('*');

    await trx('stage_history').insert({
      entity_type: 'seat',
      entity_id: seatId,
      from_stage: seat.seat_status,
      to_stage: to_status,
      changed_by: userId,
      reason: reason || null,
    });

    const remainingOpen = await trx('requirement_seats')
      .where({ requirement_id: seat.requirement_id })
      .whereNotIn('seat_status', ['closed', 'dropped']);
    if (remainingOpen.length === 0) {
      const req = await trx('requirements').where({ id: seat.requirement_id }).first();
      if (req && !['closed', 'dropped'].includes(req.status)) {
        await trx('requirements').where({ id: seat.requirement_id }).update({
          status: 'closed',
          is_locked: true,
          closed_at: trx.fn.now(),
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
};
