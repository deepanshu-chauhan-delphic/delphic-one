const prisma = require('../../config/db');

const SELECT = { id: true, name: true, created_at: true, updated_at: true };

async function list() {
  return prisma.department.findMany({ select: SELECT, orderBy: { name: 'asc' } });
}

async function create({ name }) {
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) return { error: 'name_taken' };
  const department = await prisma.department.create({ data: { name }, select: SELECT });
  return { department };
}

async function update(id, { name }) {
  const clash = await prisma.department.findFirst({ where: { name, NOT: { id } } });
  if (clash) return { error: 'name_taken' };
  const department = await prisma.department.update({ where: { id }, data: { name }, select: SELECT });
  return { department };
}

module.exports = { list, create, update };
