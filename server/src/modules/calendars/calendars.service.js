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

// Assign (or reassign) which calendar an org membership follows for a given
// project (`account_id`), or its default calendar when `account_id` is
// omitted. Changed 2026-09-15 (client brief): an employee on more than one
// concurrent client engagement can carry more than one active mapping at
// once — this is no longer "one calendar per membership", it's one per
// (membership, project).
async function assign(orgId, calendarId, orgMembershipId, accountId = null) {
  const calendar = await prisma.calendar.findFirst({ where: { id: calendarId, org_id: orgId } });
  if (!calendar) return { error: 'calendar_not_found' };
  const membership = await prisma.orgMembership.findFirst({ where: { id: orgMembershipId, org_id: orgId } });
  if (!membership) return { error: 'membership_not_found' };
  if (accountId) {
    const account = await prisma.account.findFirst({ where: { id: accountId, org_id: orgId } });
    if (!account) return { error: 'account_not_found' };
  }

  // Reassigning the SAME project (or the default, account_id: null) to a
  // different calendar should replace the old mapping, not add a second row
  // for the same project — find-then-upsert since account_id being
  // nullable in the compound unique means Postgres won't enforce that for us
  // (NULL <> NULL), see the schema comment on EmployeeCalendar.
  const existing = await prisma.employeeCalendar.findFirst({
    where: { org_membership_id: orgMembershipId, account_id: accountId },
  });
  const assignment = existing
    ? await prisma.employeeCalendar.update({ where: { id: existing.id }, data: { calendar_id: calendarId } })
    : await prisma.employeeCalendar.create({
        data: { org_membership_id: orgMembershipId, calendar_id: calendarId, account_id: accountId },
      });
  return { assignment };
}

async function listAssignments(orgId, orgMembershipId) {
  return prisma.employeeCalendar.findMany({
    where: { org_membership_id: orgMembershipId, org_membership: { org_id: orgId } },
    include: { calendar: true, account: { select: { id: true, name: true } } },
    orderBy: { created_at: 'asc' },
  });
}

module.exports = { list, create, listHolidays, addHoliday, assign, listAssignments };
