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

module.exports = { getById, list, create, update, countActiveSuperadmins };
