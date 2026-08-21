const prisma = require('../../config/db');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    body: row.body,
    created_at: row.created_at,
    user: row.user ? { id: row.user.id, name: row.user.name, role: row.user.role } : undefined,
  };
}

async function list({ entity_type, entity_id }) {
  const rows = await prisma.comment.findMany({
    where: { entity_type, entity_id },
    orderBy: { created_at: 'asc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  return rows.map(serialize);
}

async function create(data, userId) {
  const row = await prisma.comment.create({
    data: { ...data, user_id: userId },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  return serialize(row);
}

module.exports = { list, create };
