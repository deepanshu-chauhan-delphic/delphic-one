const prisma = require('../../config/db');
const { STUCK_THRESHOLD_DAYS } = require('../../config/constants');
const { computeClosureDetail } = require('../../utils/closureProgress');
const { requirementScopeWhere } = require('../access/requirementScope');

const REQUIREMENT_INCLUDE = {
  account: {
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, name: true } },
    },
  },
  sales_owner: { select: { id: true, name: true } },
  seats: { select: { id: true, seat_status: true } },
  assignments: {
    where: { role_on_req: 'recruiter', unassigned_at: null },
    include: { user: { select: { id: true, name: true } } },
  },
};

function parseCsvList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function serializeRequirement(row, cutoff) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    account: row.account
      ? {
          id: row.account.id,
          name: row.account.name,
          owner: row.account.owner || null,
        }
      : null,
    sales_owner: row.sales_owner ? { id: row.sales_owner.id, name: row.sales_owner.name } : null,
    recruiters: (row.assignments || []).map((assignment) => ({
      id: assignment.user.id,
      name: assignment.user.name,
    })),
    seats_total: row.seats_total,
    seats_closed: row.seats.filter((s) => s.seat_status === 'closed').length,
    created_at: row.created_at,
    sla_days: row.sla_days,
    is_stuck: ['open', 'in_progress'].includes(row.status) && new Date(row.created_at) <= cutoff,
    past_sla:
      row.sla_days != null
      && ['open', 'in_progress'].includes(row.status)
      && Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000) > row.sla_days,
  };
}

async function getBoard(user, filters = {}) {
  const {
    search,
    stuck,
    past_sla_only,
    account_id,
    bda_id,
    sales_id,
    recruiter_id,
    status,
    priority,
    submission_stage,
    date_from,
    date_to,
  } = filters;

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 86400000);
  const scopeWhere = await requirementScopeWhere(user);
  const statuses = parseCsvList(status);
  const priorities = parseCsvList(priority);
  const stages = parseCsvList(submission_stage);

  const where = { ...scopeWhere };
  if (account_id) where.account_id = account_id;
  if (sales_id) where.sales_owner_id = sales_id;
  if (bda_id) where.account = { ...(where.account || {}), owner_id: bda_id };
  if (statuses.length) where.status = { in: statuses };
  if (priorities.length) where.priority = { in: priorities };
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at.gte = new Date(date_from);
    if (date_to) {
      const end = new Date(date_to);
      if (String(date_to).length <= 10) end.setHours(23, 59, 59, 999);
      where.created_at.lte = end;
    }
  }
  if (recruiter_id) {
    where.assignments = {
      some: { user_id: recruiter_id, role_on_req: 'recruiter', unassigned_at: null },
    };
  }
  if (search) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { account: { name: { contains: search, mode: 'insensitive' } } },
          {
            seats: {
              some: { submissions: { some: { profile: { name: { contains: search, mode: 'insensitive' } } } } },
            },
          },
        ],
      },
    ];
  }

  const requirementRows = await prisma.requirement.findMany({
    where,
    include: REQUIREMENT_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  let requirements = requirementRows.map((row) => serializeRequirement(row, cutoff));
  if (stuck === 'stuck') requirements = requirements.filter((r) => r.is_stuck);
  else if (stuck === 'not_stuck') requirements = requirements.filter((r) => !r.is_stuck);
  if (past_sla_only) requirements = requirements.filter((r) => r.past_sla);

  const visibleRequirementIds = new Set(requirements.map((r) => r.id));
  const seatIds = requirementRows
    .filter((row) => visibleRequirementIds.has(row.id))
    .flatMap((row) => row.seats.map((s) => s.id));

  const submissionRows = seatIds.length
    ? await prisma.submission.findMany({
        where: {
          requirement_seat_id: { in: seatIds },
          ...(stages.length ? { stage: { in: stages } } : {}),
        },
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              source: true,
              vendor_account: { select: { id: true, name: true } },
            },
          },
          submitted_by_user: { select: { id: true, name: true } },
          seat: { select: { requirement_id: true } },
          interview_rounds: { select: { result: true, round_type: true, round_number: true } },
        },
        orderBy: { created_at: 'asc' },
      })
    : [];

  // Candidate-stage filter: only keep requirements that actually have a candidate
  // in one of the selected stages (submissionRows is already stage-filtered above).
  if (stages.length) {
    const reqIdsWithMatch = new Set(submissionRows.map((row) => row.seat.requirement_id));
    requirements = requirements.filter((r) => reqIdsWithMatch.has(r.id));
  }

  const submissions = submissionRows.map((row) => ({
    id: row.id,
    stage: row.stage,
    requirement: { id: row.seat.requirement_id },
    profile: row.profile,
    submitted_by: row.submitted_by_user,
    // Internal screening round results (internal_r1 / internal_r2) for the card badges.
    internal_rounds: (row.interview_rounds || [])
      .filter((r) => r.round_type === 'internal_r1' || r.round_type === 'internal_r2')
      .map((r) => ({ round_type: r.round_type, round_number: r.round_number, result: r.result })),
    progress: computeClosureDetail(row.stage, row.interview_rounds),
  }));

  return { requirements, submissions };
}

module.exports = { getBoard, requirementScopeWhere };
