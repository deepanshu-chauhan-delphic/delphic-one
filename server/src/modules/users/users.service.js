const bcrypt = require('bcryptjs');
const db = require('../../config/db');

const PUBLIC_COLUMNS = ['id', 'name', 'email', 'phone', 'role', 'active', 'created_at'];

async function getById(id) {
  return db('users').select(PUBLIC_COLUMNS).where({ id }).first();
}

async function list({ role, active, search, page = 1, limit = 20 }) {
  const query = db('users').select(PUBLIC_COLUMNS);

  if (role) query.where({ role });
  if (active !== undefined) query.where({ active });
  if (search) {
    query.where((qb) => {
      qb.whereILike('name', `%${search}%`).orWhereILike('email', `%${search}%`);
    });
  }

  const countQuery = query.clone().clearSelect().clearOrder().count({ count: '*' }).first();
  const [{ count }, rows] = await Promise.all([
    countQuery,
    query.orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit),
  ]);

  const total = Number(count);
  return { rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function create({ name, email, password, role, phone }) {
  const password_hash = await bcrypt.hash(password, 10);
  const [row] = await db('users')
    .insert({ name, email, password_hash, role, phone: phone || null })
    .returning(PUBLIC_COLUMNS);
  return row;
}

async function update(id, patch) {
  const [row] = await db('users').where({ id }).update({ ...patch, updated_at: db.fn.now() }).returning(PUBLIC_COLUMNS);
  return row;
}

module.exports = { getById, list, create, update };
