const path = require('path');
const fs = require('fs');
const prisma = require('../../config/db');
const env = require('../../config/env');

function serialize(row) {
  if (!row) return null;
  const { uploaded_by, uploaded_by_user, ...rest } = row;
  return { ...rest, uploaded_by: uploaded_by_user };
}

async function list({ entity_type, entity_id }) {
  const rows = await prisma.document.findMany({
    where: {
      ...(entity_type ? { entity_type } : {}),
      ...(entity_id ? { entity_id } : {}),
    },
    orderBy: { uploaded_at: 'desc' },
    include: { uploaded_by_user: { select: { id: true, name: true } } },
  });
  return rows.map(serialize);
}

async function create({ entity_type, entity_id, label, file }, userId) {
  if (!file) return { error: 'file_required' };

  const row = await prisma.document.create({
    data: {
      entity_type,
      entity_id,
      label,
      file_url: `/uploads/${file.filename}`,
      file_type: file.mimetype,
      file_size_bytes: file.size,
      uploaded_by: userId,
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
