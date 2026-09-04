const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  active: true,
  is_superadmin: true,
  department_id: true,
  created_at: true,
  department: { select: { id: true, name: true } },
};

async function countActiveSuperadmins() {
  return prisma.user.count({ where: { is_superadmin: true, active: true } });
}

async function getById(id) {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
}

async function list({ role, active, search, department_id, page = 1, limit = 20 }) {
  const where = {
    ...(role ? { role } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(department_id ? { department_id } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function create({ name, email, password, role, phone, department_id }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'email_taken' };

  const password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password_hash,
      role,
      phone: phone || null,
      department_id: department_id || null,
    },
    select: PUBLIC_SELECT,
  });
  return { user };
}

async function update(id, patch, actor = {}) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { error: 'not_found' };

  if ('is_superadmin' in patch && !actor.is_superadmin) return { error: 'forbidden_superadmin_field' };
  if (patch.password !== undefined && !actor.is_superadmin) return { error: 'forbidden_password' };
  if (target.is_superadmin && !actor.is_superadmin) return { error: 'forbidden_edit_superadmin' };

  const stripsPowers =
    patch.is_superadmin === false || patch.active === false || (patch.role && patch.role !== 'admin');
  if (target.is_superadmin && stripsPowers && (await countActiveSuperadmins()) <= 1) {
    return { error: 'last_superadmin' };
  }

  if (patch.email) {
    const clash = await prisma.user.findFirst({ where: { email: patch.email, NOT: { id } } });
    if (clash) return { error: 'email_taken' };
  }

  const data = { ...patch };
  if (data.password) {
    data.password_hash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }

  const user = await prisma.user.update({ where: { id }, data, select: PUBLIC_SELECT });
  return { user };
}

/**
 * Reverse-chronological list of stage/status changes the given user has made,
 * across accounts, requirements, seats, and submissions. Read-only; powers the
 * "Activity" tab on the Settings page.
 */
async function listActivity(userId, { limit = 50 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await prisma.stageHistory.findMany({
    where: { changed_by: userId },
    orderBy: { changed_at: 'desc' },
    take,
  });

  const ids = { account: new Set(), requirement: new Set(), seat: new Set(), submission: new Set() };
  rows.forEach((r) => ids[r.entity_type]?.add(r.entity_id));

  const [accounts, requirements, seats, submissions] = await Promise.all([
    ids.account.size
      ? prisma.account.findMany({ where: { id: { in: [...ids.account] } }, select: { id: true, name: true } })
      : [],
    ids.requirement.size
      ? prisma.requirement.findMany({ where: { id: { in: [...ids.requirement] } }, select: { id: true, title: true } })
      : [],
    ids.seat.size
      ? prisma.requirementSeat.findMany({
          where: { id: { in: [...ids.seat] } },
          select: { id: true, requirement: { select: { title: true } } },
        })
      : [],
    ids.submission.size
      ? prisma.submission.findMany({
          where: { id: { in: [...ids.submission] } },
          select: {
            id: true,
            profile: { select: { name: true } },
            seat: { select: { requirement: { select: { title: true } } } },
          },
        })
      : [],
  ]);

  const label = {
    account: Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    requirement: Object.fromEntries(requirements.map((r) => [r.id, r.title])),
    seat: Object.fromEntries(seats.map((s) => [s.id, s.requirement?.title || 'Seat'])),
    submission: Object.fromEntries(
      submissions.map((s) => [
        s.id,
        `${s.profile?.name || 'Candidate'} → ${s.seat?.requirement?.title || 'Requirement'}`,
      ])
    ),
  };

  return rows.map((r) => ({
    id: r.id,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    entity_label: label[r.entity_type]?.[r.entity_id] || null,
    from_stage: r.from_stage,
    to_stage: r.to_stage,
    reason: r.reason,
    changed_at: r.changed_at,
  }));
}

module.exports = { getById, list, create, update, countActiveSuperadmins, listActivity };
