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

// Client brief: default (Ahmedabad/Indore/Gurgaon) + custom locations, an
// Org-scoped directory used by calendars (holiday sets) and OrgMembership
// (an employee's office).
async function listLocations(orgId) {
  return prisma.location.findMany({ where: { org_id: orgId }, orderBy: { name: 'asc' } });
}

async function createLocation(orgId, { name, city, country, is_default }) {
  const existing = await prisma.location.findUnique({ where: { org_id_name: { org_id: orgId, name } } });
  if (existing) return { error: 'name_taken' };
  const location = await prisma.location.create({ data: { org_id: orgId, name, city, country, is_default } });
  return { location };
}

const MEMBERSHIP_DETAIL_SELECT = {
  id: true,
  org_id: true,
  role: true,
  employment_status: true,
  location: { select: { id: true, name: true } },
  shift: { select: { id: true, name: true, start_minutes: true, end_minutes: true, grace_minutes: true } },
  manager: { select: { id: true, person: { select: { id: true, name: true } } } },
  hr_poc: { select: { id: true, name: true } },
  sourcing_poc: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
};

// HR/Sourcing POC + location/shift/manager/directory mapping — client brief
// "Stakeholder & HR POC mapping". A manager must be a membership in the
// same org (can't report to someone at a different company).
async function updateMembership(orgId, membershipId, patch) {
  const membership = await prisma.orgMembership.findFirst({ where: { id: membershipId, org_id: orgId } });
  if (!membership) return { error: 'not_found' };

  if (patch.manager_id) {
    if (patch.manager_id === membershipId) return { error: 'self_manager' };
    const manager = await prisma.orgMembership.findFirst({ where: { id: patch.manager_id, org_id: orgId } });
    if (!manager) return { error: 'manager_not_found' };
  }

  const updated = await prisma.orgMembership.update({
    where: { id: membershipId },
    data: patch,
    select: MEMBERSHIP_DETAIL_SELECT,
  });
  return { membership: updated };
}

module.exports = { listMyMemberships, listOrgs, listLocations, createLocation, updateMembership };
