const prisma = require('../../config/db');

const MEMBERSHIP_SELECT = {
  id: true,
  org_id: true,
  role: true,
  employment_status: true,
  employee_code: true,
  joined_at: true,
  org: { select: { id: true, name: true, slug: true, status: true } },
};

// Powers the org switcher UI: every org the caller currently belongs to.
async function listMyMemberships(userId) {
  return prisma.orgMembership.findMany({
    where: { person_id: userId, employment_status: 'active' },
    orderBy: { joined_at: 'asc' },
    select: MEMBERSHIP_SELECT,
  });
}

// Group-superadmin only (see authorizeGroupSuperadmin) — the org picker for
// cross-org admin screens / the future super dashboard.
async function listOrgs() {
  return prisma.org.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, status: true, timezone: true, default_currency: true },
  });
}

module.exports = { listMyMemberships, listOrgs };
