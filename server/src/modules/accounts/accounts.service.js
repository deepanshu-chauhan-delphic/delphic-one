const db = require('../../config/db');

const TRANSITIONS = {
  lead: ['meeting_scheduled'],
  meeting_scheduled: ['active', 'rescheduled', 'dropped'],
  rescheduled: ['meeting_scheduled', 'dropped'],
  active: ['dropped'],
  dropped: [],
};

function serialize(row, owner) {
  if (!row) return null;
  const { owner_id, ...rest } = row;
  return { ...rest, owner: owner ? { id: owner.id, name: owner.name } : null };
}

async function withOwner(row) {
  if (!row) return null;
  const owner = await db('users').select('id', 'name').where({ id: row.owner_id }).first();
  return serialize(row, owner);
}

async function list({ type, stage, owner_id, industry, search, created_from, created_to, sort_by, sort_order, page, limit }) {
  const query = db('accounts');

  if (type) query.where({ type });
  if (stage) query.where({ stage });
  if (owner_id) query.where({ owner_id });
  if (industry) query.whereILike('industry', `%${industry}%`);
  if (search) {
    query.where((qb) => {
      qb.whereILike('name', `%${search}%`)
        .orWhereILike('poc_name', `%${search}%`)
        .orWhereILike('poc_email', `%${search}%`);
    });
  }
  if (created_from) query.where('created_at', '>=', created_from);
  if (created_to) query.where('created_at', '<=', created_to);

  const total = Number((await query.clone().count({ count: '*' }).first()).count);
  const rows = await query.orderBy(sort_by, sort_order).limit(limit).offset((page - 1) * limit);

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const owners = ownerIds.length ? await db('users').select('id', 'name').whereIn('id', ownerIds) : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return {
    rows: rows.map((r) => serialize(r, ownerMap.get(r.owner_id))),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const row = await db('accounts').where({ id }).first();
  return withOwner(row);
}

async function create(data, ownerId) {
  const [row] = await db('accounts')
    .insert({ ...data, owner_id: ownerId })
    .returning('*');
  return withOwner(row);
}

async function update(id, patch) {
  const [row] = await db('accounts')
    .where({ id })
    .update({ ...patch, updated_at: db.fn.now() })
    .returning('*');
  return withOwner(row);
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

async function changeStage(id, { to_stage, reason, meeting_mode, meeting_date }, userId) {
  return db.transaction(async (trx) => {
    const account = await trx('accounts').where({ id }).first();
    if (!account) return { error: 'not_found' };
    if (account.is_locked) return { error: 'locked' };
    if (!canTransition(account.stage, to_stage)) return { error: 'invalid_transition' };
    if (to_stage === 'dropped' && !reason) return { error: 'reason_required' };
    if ((to_stage === 'meeting_scheduled') && (!meeting_mode || !meeting_date)) {
      return { error: 'meeting_fields_required' };
    }

    const patch = { stage: to_stage, updated_at: trx.fn.now() };
    if (to_stage === 'meeting_scheduled') {
      patch.meeting_mode = meeting_mode;
      patch.meeting_date = meeting_date;
    }
    if (to_stage === 'dropped') patch.is_locked = true;

    const [updated] = await trx('accounts').where({ id }).update(patch).returning('*');

    const [historyRow] = await trx('stage_history')
      .insert({
        entity_type: 'account',
        entity_id: id,
        from_stage: account.stage,
        to_stage,
        changed_by: userId,
        reason: reason || null,
      })
      .returning('*');

    const owner = await trx('users').select('id', 'name').where({ id: updated.owner_id }).first();
    return { account: serialize(updated, owner), history: historyRow };
  });
}

async function getHistory(id) {
  const rows = await db('stage_history').where({ entity_type: 'account', entity_id: id }).orderBy('changed_at', 'asc');
  const userIds = [...new Set(rows.map((r) => r.changed_by))];
  const users = userIds.length ? await db('users').select('id', 'name').whereIn('id', userIds) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    id: r.id,
    from_stage: r.from_stage,
    to_stage: r.to_stage,
    changed_by: userMap.get(r.changed_by) || null,
    reason: r.reason,
    changed_at: r.changed_at,
  }));
}

module.exports = { list, getById, create, update, changeStage, getHistory, canTransition };
