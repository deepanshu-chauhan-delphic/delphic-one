const path = require('path');
const fs = require('fs');
const prisma = require('../../config/db');
const env = require('../../config/env');
const { assertCanAccessEntity } = require('../../lib/entityAccess');

function serialize(row) {
  if (!row) return null;
  const { uploaded_by, uploaded_by_user, ...rest } = row;
  return { ...rest, uploaded_by: uploaded_by_user };
}

async function list({ entity_type, entity_id }, user) {
  if (!entity_type || !entity_id) {
    if (user.role !== 'admin') return { error: 'filters_required' };
    const rows = await prisma.document.findMany({
      orderBy: { uploaded_at: 'desc' },
      include: { uploaded_by_user: { select: { id: true, name: true } } },
    });
    return { documents: rows.map(serialize) };
  }

  const access = await assertCanAccessEntity(user, entity_type, entity_id);
  if (access.error) return { error: access.error };

  const rows = await prisma.document.findMany({
    where: { entity_type, entity_id },
    orderBy: { uploaded_at: 'desc' },
    include: { uploaded_by_user: { select: { id: true, name: true } } },
  });
  return { documents: rows.map(serialize) };
}

async function create({ entity_type, entity_id, label, file }, user) {
  if (!file) return { error: 'file_required' };

  const access = await assertCanAccessEntity(user, entity_type, entity_id);
  if (access.error) return { error: access.error };

  const row = await prisma.document.create({
    data: {
      entity_type,
      entity_id,
      label,
      file_url: `/uploads/${file.filename}`,
      file_type: file.mimetype,
      file_size_bytes: file.size,
      uploaded_by: user.id,
    },
    include: { uploaded_by_user: { select: { id: true, name: true } } },
  });

  return { document: serialize(row) };
}

async function remove(id, user) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return { error: 'not_found' };
  if (doc.uploaded_by !== user.id && user.role !== 'admin') return { error: 'forbidden' };

  await prisma.document.delete({ where: { id } });
  const filePath = path.join(env.uploadDir, path.basename(doc.file_url));
  fs.unlink(filePath, () => {});

  return { ok: true };
}

module.exports = { list, create, remove };
