const prisma = require('../../config/db');

async function isLocked(orgId, date) {
  const lock = await prisma.timesheetLock.findUnique({ where: { org_id_date: { org_id: orgId, date } } });
  return Boolean(lock);
}

async function createEntry(orgId, orgMembershipId, { date, account_id, requirement_id, hours, billable, notes }) {
  if (await isLocked(orgId, date)) return { error: 'day_locked' };

  const account = await prisma.account.findFirst({ where: { id: account_id, org_id: orgId } });
  if (!account) return { error: 'account_not_found' };
  if (requirement_id) {
    const requirement = await prisma.requirement.findFirst({ where: { id: requirement_id, account_id, org_id: orgId } });
    if (!requirement) return { error: 'requirement_not_found' };
  }

  // Multi-project allocation (client brief: 4h Project A + 4h Project B in
  // one day) is fine; the total for the day still can't exceed 24h.
  const existing = await prisma.timesheetEntry.findMany({
    where: { org_membership_id: orgMembershipId, date, status: { not: 'rejected' } },
    select: { hours: true },
  });
  const totalHours = existing.reduce((sum, e) => sum + Number(e.hours), 0) + hours;
  if (totalHours > 24) return { error: 'exceeds_day_hours' };

  const entry = await prisma.timesheetEntry.create({
    data: { org_id: orgId, org_membership_id: orgMembershipId, date, account_id, requirement_id, hours, billable, notes },
  });
  return { entry };
}

function dateRangeWhere({ from, to }) {
  if (!from && !to) return undefined;
  return { gte: from || undefined, lte: to || undefined };
}

async function listMine(orgMembershipId, { from, to, account_id, status, page, limit }) {
  const date = dateRangeWhere({ from, to });
  const where = {
    org_membership_id: orgMembershipId,
    ...(date ? { date } : {}),
    ...(account_id ? { account_id } : {}),
    ...(status ? { status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { account: { select: { id: true, name: true } }, requirement: { select: { id: true, title: true } } },
    }),
    prisma.timesheetEntry.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

async function listTeam(orgId, { from, to, org_membership_id, account_id, status, page, limit }) {
  const date = dateRangeWhere({ from, to });
  const where = {
    org_id: orgId,
    ...(org_membership_id ? { org_membership_id } : {}),
    ...(account_id ? { account_id } : {}),
    ...(status ? { status } : {}),
    ...(date ? { date } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        org_membership: { select: { id: true, person: { select: { id: true, name: true } } } },
        account: { select: { id: true, name: true } },
        requirement: { select: { id: true, title: true } },
      },
    }),
    prisma.timesheetEntry.count({ where }),
  ]);
  return { data, pagination: { page, limit, total } };
}

// Owner-only, and only while still 'submitted' (not yet decided) and the
// day isn't locked — a locked/decided entry can only change via a
// regularization ticket.
async function updateEntry(orgId, orgMembershipId, entryId, patch) {
  const existing = await prisma.timesheetEntry.findFirst({ where: { id: entryId, org_id: orgId, org_membership_id: orgMembershipId } });
  if (!existing) return { error: 'not_found' };
  if (existing.status !== 'submitted') return { error: 'already_decided' };
  if (await isLocked(orgId, existing.date)) return { error: 'day_locked' };

  const entry = await prisma.timesheetEntry.update({ where: { id: entryId }, data: patch });
  return { entry };
}

async function decideEntry(orgId, entryId, adminUserId, { status, reason }) {
  const existing = await prisma.timesheetEntry.findFirst({ where: { id: entryId, org_id: orgId } });
  if (!existing) return { error: 'not_found' };
  if (existing.status !== 'submitted') return { error: 'already_decided' };

  const entry = await prisma.timesheetEntry.update({
    where: { id: entryId },
    data: { status, approved_by: adminUserId, approved_at: new Date(), decision_reason: reason },
  });
  return { entry };
}

// Org-wide daily lock — freezes every TimesheetEntry for that date.
async function lockDay(orgId, date, adminUserId) {
  const existing = await prisma.timesheetLock.findUnique({ where: { org_id_date: { org_id: orgId, date } } });
  if (existing) return { error: 'already_locked', lock: existing };
  const lock = await prisma.timesheetLock.create({ data: { org_id: orgId, date, locked_by: adminUserId } });
  return { lock };
}

async function listLocks(orgId) {
  return prisma.timesheetLock.findMany({ where: { org_id: orgId }, orderBy: { date: 'desc' } });
}

// Post-lock change request — the whole point of the flow is that this is
// the ONLY path to change a locked day's entry.
async function createTicket(orgId, entryId, requestedByUserId, { requested_change, reason }) {
  const entry = await prisma.timesheetEntry.findFirst({ where: { id: entryId, org_id: orgId } });
  if (!entry) return { error: 'not_found' };
  if (!(await isLocked(orgId, entry.date))) return { error: 'not_locked' };

  const ticket = await prisma.timesheetRegularizationTicket.create({
    data: { timesheet_entry_id: entryId, requested_by: requestedByUserId, requested_change, reason },
  });
  return { ticket };
}

async function listTickets(orgId, { status } = {}) {
  return prisma.timesheetRegularizationTicket.findMany({
    where: { status, timesheet_entry: { org_id: orgId } },
    orderBy: { created_at: 'desc' },
    include: {
      timesheet_entry: { include: { account: { select: { id: true, name: true } } } },
      requester: { select: { id: true, name: true } },
    },
  });
}

// Approving applies the requested field-by-field patch to the entry —
// requested_change was already validated to only contain
// hours/billable/notes (timesheets.validation.js), never trusted as an
// arbitrary write.
async function decideTicket(orgId, ticketId, adminUserId, { status, decision_reason }) {
  const ticket = await prisma.timesheetRegularizationTicket.findFirst({
    where: { id: ticketId, timesheet_entry: { org_id: orgId } },
    include: { timesheet_entry: true },
  });
  if (!ticket) return { error: 'not_found' };
  if (ticket.status !== 'pending') return { error: 'already_decided' };

  const updated = await prisma.$transaction(async (tx) => {
    const decided = await tx.timesheetRegularizationTicket.update({
      where: { id: ticketId },
      data: { status, decided_by: adminUserId, decided_at: new Date(), decision_reason },
    });
    if (status === 'approved') {
      await tx.timesheetEntry.update({ where: { id: ticket.timesheet_entry_id }, data: ticket.requested_change });
    }
    return decided;
  });
  return { ticket: updated };
}

module.exports = {
  isLocked,
  createEntry,
  listMine,
  listTeam,
  updateEntry,
  decideEntry,
  lockDay,
  listLocks,
  createTicket,
  listTickets,
  decideTicket,
};
