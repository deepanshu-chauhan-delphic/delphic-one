const prisma = require('../../config/db');

const TRANSITIONS = {
  lead: ['meeting_scheduled'],
  meeting_scheduled: ['active', 'rescheduled', 'dropped'],
  rescheduled: ['meeting_scheduled', 'dropped'],
  active: ['dropped'],
  dropped: [],
};

function serialize(row) {
  if (!row) return null;
  const { owner_id, owner, ...rest } = row;
  return { ...rest, owner: owner ? { id: owner.id, name: owner.name } : null };
}

async function list({ type, stage, owner_id, industry, search, created_from, created_to, sort_by, sort_order, page, limit }) {
  const where = {
    ...(type ? { type } : {}),
    ...(stage ? { stage } : {}),
    ...(owner_id ? { owner_id } : {}),
    ...(industry ? { industry: { contains: industry, mode: 'insensitive' } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { poc_name: { contains: search, mode: 'insensitive' } },
            { poc_email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(created_from || created_to
      ? { created_at: { ...(created_from ? { gte: new Date(created_from) } : {}), ...(created_to ? { lte: new Date(created_to) } : {}) } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { [sort_by]: sort_order },
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  return { rows: rows.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await prisma.account.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true } } } });
  return serialize(row);
}

function canMutateAccount(account, user) {
  if (!account) return false;
  if (user.role === 'admin') return true;
  return user.role === 'bda' && account.owner_id === user.id;
}

async function create(data, ownerId) {
  const row = await prisma.account.create({
    data: { ...data, owner_id: ownerId },
    include: { owner: { select: { id: true, name: true } } },
  });
  return serialize(row);
}

async function update(id, patch, user) {
  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) return { error: 'not_found' };
  if (!canMutateAccount(existing, user)) return { error: 'forbidden' };

  const row = await prisma.account.update({
    where: { id },
    data: patch,
    include: { owner: { select: { id: true, name: true } } },
  });
  return { account: serialize(row) };
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

async function changeStage(id, { to_stage, reason, meeting_mode, meeting_date }, user) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({ where: { id } });
    if (!account) return { error: 'not_found' };
    if (!canMutateAccount(account, user)) return { error: 'forbidden' };
    if (account.is_locked) return { error: 'locked' };
    if (!canTransition(account.stage, to_stage)) return { error: 'invalid_transition' };
    if (to_stage === 'dropped' && !reason) return { error: 'reason_required' };
    if (to_stage === 'meeting_scheduled' && (!meeting_mode || !meeting_date)) {
      return { error: 'meeting_fields_required' };
    }

    const patch = { stage: to_stage };
    if (to_stage === 'meeting_scheduled') {
      patch.meeting_mode = meeting_mode;
      patch.meeting_date = new Date(meeting_date);
    }
    if (to_stage === 'dropped') patch.is_locked = true;

    const updated = await tx.account.update({
      where: { id },
      data: patch,
      include: { owner: { select: { id: true, name: true } } },
    });

    const historyRow = await tx.stageHistory.create({
      data: {
        entity_type: 'account',
        entity_id: id,
        from_stage: account.stage,
        to_stage,
        changed_by: user.id,
        reason: reason || null,
      },
    });

    return { account: serialize(updated), history: historyRow };
  });
}

async function getHistory(id) {
  const rows = await prisma.stageHistory.findMany({
    where: { entity_type: 'account', entity_id: id },
    orderBy: { changed_at: 'asc' },
    include: { changed_by_user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    from_stage: r.from_stage,
    to_stage: r.to_stage,
    changed_by: r.changed_by_user,
    reason: r.reason,
    changed_at: r.changed_at,
  }));
}

module.exports = { list, getById, create, update, changeStage, getHistory, canTransition, canMutateAccount };
