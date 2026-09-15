const prisma = require('../../config/db');

async function list(orgId) {
  return prisma.calendar.findMany({
    where: { org_id: orgId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { holidays: true, employees: true } } },
  });
}

async function create(orgId, { name, kind, is_default }) {
  return prisma.calendar.create({ data: { org_id: orgId, name, kind, is_default } });
}

async function listHolidays(orgId, calendarId) {
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, org_id: orgId } });
  if (!calendar) return { error: 'not_found' };
  const holidays = await prisma.calendarHoliday.findMany({
    where: { calendar_id: calendarId },
    orderBy: { date: 'asc' },
  });
  return { holidays };
}

async function addHoliday(orgId, calendarId, { date, label }) {
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, org_id: orgId } });
  if (!calendar) return { error: 'not_found' };
  const existing = await prisma.calendarHoliday.findUnique({
    where: { calendar_id_date: { calendar_id: calendarId, date } },
  });
  if (existing) return { error: 'already_exists' };
  const holiday = await prisma.calendarHoliday.create({ data: { calendar_id: calendarId, date, label } });
  return { holiday };
}

// Assign (or reassign) which calendar an org membership's attendance/leave
// follows. One active calendar per membership — upsert on the unique FK.
async function assign(orgId, calendarId, orgMembershipId) {
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, org_id: orgId } });
  if (!calendar) return { error: 'calendar_not_found' };
  const membership = await prisma.orgMembership.findFirst({ where: { id: orgMembershipId, org_id: orgId } });
  if (!membership) return { error: 'membership_not_found' };

  const assignment = await prisma.employeeCalendar.upsert({
    where: { org_membership_id: orgMembershipId },
    create: { org_membership_id: orgMembershipId, calendar_id: calendarId },
    update: { calendar_id: calendarId },
  });
  return { assignment };
}

module.exports = { list, create, listHolidays, addHoliday, assign };
