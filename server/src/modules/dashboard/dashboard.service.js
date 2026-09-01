const prisma = require('../../config/db');
const { STUCK_THRESHOLD_DAYS } = require('../../config/constants');

const STUCK_LIMIT = 5;

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

/**
 * Same anchor rule as reports.summarizeInterviewRounds: a completed round counts by
 * completed_at, an uncompleted one by scheduled_at — kept in sync so "interviews this
 * week" agrees between the dashboard and the reports pages for the same person/period.
 */
function interviewsInRangeWhere(from, extra = {}) {
  return {
    ...extra,
    OR: [{ completed_at: { gte: from } }, { completed_at: null, scheduled_at: { gte: from } }],
  };
}

function funnelFromRows(rows) {
  const map = Object.fromEntries(rows.map((r) => [r.stage, r._count.id]));
  return {
    sourced: map.sourced || 0,
    screening: map.internal_screening || 0,
    submitted: map.submitted_to_client || 0,
    interviewing: map.interview_scheduled || 0,
    offered: map.offer || 0,
    bgv: map.bgv || 0,
    closed: map.closed || 0,
  };
}

/** Lead funnel for BDA: account stage distribution instead of submission stage. */
function accountFunnelFromRows(rows) {
  const map = Object.fromEntries(rows.map((r) => [r.stage, r._count.id]));
  return {
    lead: map.lead || 0,
    meeting_scheduled: map.meeting_scheduled || 0,
    rescheduled: map.rescheduled || 0,
    active: map.active || 0,
    dropped: map.dropped || 0,
  };
}

async function stuckLeads(whereExtra = {}) {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 86400000);
  const rows = await prisma.account.findMany({
    where: {
      stage: { in: ['lead', 'meeting_scheduled', 'rescheduled'] },
      updated_at: { lte: cutoff },
      ...whereExtra,
    },
    orderBy: { updated_at: 'asc' },
    take: STUCK_LIMIT,
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    days_in_stage: daysSince(l.updated_at),
  }));
}

async function stuckRequirements(whereExtra = {}) {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 86400000);
  const rows = await prisma.requirement.findMany({
    where: {
      status: { in: ['open', 'in_progress'] },
      created_at: { lte: cutoff },
      ...whereExtra,
    },
    include: { seats: { select: { id: true } } },
    orderBy: { created_at: 'asc' },
    take: STUCK_LIMIT,
  });

  return Promise.all(
    rows.map(async (r) => {
      const seatIds = r.seats.map((s) => s.id);
      const submissions_count = seatIds.length
        ? await prisma.submission.count({ where: { requirement_seat_id: { in: seatIds } } })
        : 0;
      return {
        id: r.id,
        title: r.title,
        days_open: daysSince(r.created_at),
        submissions_count,
      };
    })
  );
}

async function recentActivity(whereExtra = {}) {
  const rows = await prisma.stageHistory.findMany({
    where: whereExtra,
    orderBy: { changed_at: 'desc' },
    take: 10,
    include: { changed_by_user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    entity_label: r.entity_type,
    action: `stage changed to ${r.to_stage}`,
    user: r.changed_by_user,
    timestamp: r.changed_at,
  }));
}

async function summaryForAdmin(department_id) {
  const month = startOfMonth();
  const week = startOfWeek();
  const salesDept = department_id ? { sales_owner: { department_id } } : {};
  const ownerDept = department_id ? { owner: { department_id } } : {};
  const submissionDept = department_id ? { submitted_by_user: { department_id } } : {};

  const [
    leads_active,
    leads_in_meeting,
    clients_active,
    vendors_active,
    requirements_open,
    requirements_in_progress,
    requirements_closed_this_month,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    funnelRows,
    stuck_leads,
    stuck_requirements,
    recent_activity,
  ] = await Promise.all([
    prisma.account.count({ where: { stage: 'lead', ...ownerDept } }),
    prisma.account.count({ where: { stage: { in: ['meeting_scheduled', 'rescheduled'] }, ...ownerDept } }),
    prisma.account.count({ where: { type: 'client', stage: 'active', ...ownerDept } }),
    prisma.account.count({ where: { type: 'vendor', stage: 'active', ...ownerDept } }),
    prisma.requirement.count({ where: { status: 'open', ...salesDept } }),
    prisma.requirement.count({ where: { status: 'in_progress', ...salesDept } }),
    prisma.requirement.count({ where: { status: 'closed', closed_at: { gte: month }, ...salesDept } }),
    prisma.submission.count({
      where: { stage: { notIn: ['closed', 'rejected', 'backout'] }, ...submissionDept },
    }),
    prisma.interviewRound.count({
      where: interviewsInRangeWhere(
        week,
        department_id ? { submission: { submitted_by_user: { department_id } } } : {}
      ),
    }),
    prisma.submission.count({
      where: { actual_joining_date: { gte: month }, ...submissionDept },
    }),
    prisma.submission.groupBy({
      by: ['stage'],
      where: submissionDept,
      _count: { id: true },
    }),
    stuckLeads(ownerDept),
    stuckRequirements(salesDept),
    recentActivity(
      department_id ? { changed_by_user: { department_id } } : {}
    ),
  ]);

  return {
    leads_active,
    leads_in_meeting,
    clients_active,
    vendors_active,
    requirements_open,
    requirements_in_progress,
    requirements_closed_this_month,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    stuck_leads,
    stuck_requirements,
    recent_activity,
    pipeline_funnel: funnelFromRows(funnelRows),
  };
}

async function summaryForBda(userId) {
  const accountWhere = { owner_id: userId };
  const [
    leads_active,
    leads_in_meeting,
    clients_active,
    vendors_active,
    stuck_leads,
    recent_activity,
    funnelRows,
  ] = await Promise.all([
    prisma.account.count({ where: { ...accountWhere, stage: 'lead' } }),
    prisma.account.count({ where: { ...accountWhere, stage: { in: ['meeting_scheduled', 'rescheduled'] } } }),
    prisma.account.count({ where: { ...accountWhere, type: 'client', stage: 'active' } }),
    prisma.account.count({ where: { ...accountWhere, type: 'vendor', stage: 'active' } }),
    stuckLeads(accountWhere),
    recentActivity({ entity_type: 'account', changed_by: userId }),
    prisma.account.groupBy({ by: ['stage'], where: accountWhere, _count: { id: true } }),
  ]);

  return {
    leads_active,
    leads_in_meeting,
    clients_active,
    vendors_active,
    requirements_open: 0,
    requirements_in_progress: 0,
    requirements_closed_this_month: 0,
    submissions_active: 0,
    interviews_scheduled_this_week: 0,
    closures_this_month: 0,
    stuck_leads,
    stuck_requirements: [],
    recent_activity,
    pipeline_funnel: accountFunnelFromRows(funnelRows),
  };
}

async function summaryForSales(userId) {
  const month = startOfMonth();
  const week = startOfWeek();
  const reqWhere = { sales_owner_id: userId };

  const myReqIds = (
    await prisma.requirement.findMany({ where: reqWhere, select: { id: true } })
  ).map((r) => r.id);

  const seatIds = myReqIds.length
    ? (
        await prisma.requirementSeat.findMany({
          where: { requirement_id: { in: myReqIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];

  const submissionWhere = seatIds.length ? { requirement_seat_id: { in: seatIds } } : { id: '00000000-0000-0000-0000-000000000000' };

  const [
    requirements_open,
    requirements_in_progress,
    requirements_closed_this_month,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    funnelRows,
    stuck_requirements,
    recent_activity,
    clients_active,
  ] = await Promise.all([
    prisma.requirement.count({ where: { ...reqWhere, status: 'open' } }),
    prisma.requirement.count({ where: { ...reqWhere, status: 'in_progress' } }),
    prisma.requirement.count({ where: { ...reqWhere, status: 'closed', closed_at: { gte: month } } }),
    prisma.submission.count({
      where: { ...submissionWhere, stage: { notIn: ['closed', 'rejected', 'backout'] } },
    }),
    seatIds.length
      ? prisma.interviewRound.count({
          where: interviewsInRangeWhere(week, { submission: { requirement_seat_id: { in: seatIds } } }),
        })
      : 0,
    prisma.submission.count({
      where: { ...submissionWhere, actual_joining_date: { gte: month } },
    }),
    seatIds.length
      ? prisma.submission.groupBy({
          by: ['stage'],
          where: { requirement_seat_id: { in: seatIds } },
          _count: { id: true },
        })
      : [],
    stuckRequirements(reqWhere),
    recentActivity({
      OR: [
        { entity_type: 'requirement', entity_id: { in: myReqIds.length ? myReqIds : ['00000000-0000-0000-0000-000000000000'] } },
        { changed_by: userId },
      ],
    }),
    prisma.account.count({
      where: { type: 'client', stage: 'active', requirements: { some: { sales_owner_id: userId } } },
    }),
  ]);

  return {
    leads_active: 0,
    leads_in_meeting: 0,
    clients_active,
    vendors_active: 0,
    requirements_open,
    requirements_in_progress,
    requirements_closed_this_month,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    stuck_leads: [],
    stuck_requirements,
    recent_activity,
    pipeline_funnel: funnelFromRows(funnelRows),
  };
}

async function summaryForRecruiter(userId) {
  const month = startOfMonth();
  const week = startOfWeek();

  const assignedReqIds = (
    await prisma.requirementAssignment.findMany({
      where: { user_id: userId, role_on_req: 'recruiter', unassigned_at: null },
      select: { requirement_id: true },
    })
  ).map((a) => a.requirement_id);

  const [
    requirements_open,
    requirements_in_progress,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    funnelRows,
    stuck_requirements,
    recent_activity,
  ] = await Promise.all([
    assignedReqIds.length
      ? prisma.requirement.count({ where: { id: { in: assignedReqIds }, status: 'open' } })
      : 0,
    assignedReqIds.length
      ? prisma.requirement.count({ where: { id: { in: assignedReqIds }, status: 'in_progress' } })
      : 0,
    prisma.submission.count({
      where: { submitted_by: userId, stage: { notIn: ['closed', 'rejected', 'backout'] } },
    }),
    prisma.interviewRound.count({
      where: interviewsInRangeWhere(week, { submission: { submitted_by: userId } }),
    }),
    prisma.submission.count({
      where: { submitted_by: userId, actual_joining_date: { gte: month } },
    }),
    prisma.submission.groupBy({
      by: ['stage'],
      where: { submitted_by: userId },
      _count: { id: true },
    }),
    assignedReqIds.length ? stuckRequirements({ id: { in: assignedReqIds } }) : [],
    recentActivity({ changed_by: userId }),
  ]);

  return {
    leads_active: 0,
    leads_in_meeting: 0,
    clients_active: 0,
    vendors_active: 0,
    requirements_open,
    requirements_in_progress,
    requirements_closed_this_month: 0,
    submissions_active,
    interviews_scheduled_this_week,
    closures_this_month,
    stuck_leads: [],
    stuck_requirements,
    recent_activity,
    pipeline_funnel: funnelFromRows(funnelRows),
  };
}

async function getSummary(user, { department_id } = {}) {
  if (user.role === 'admin') return summaryForAdmin(department_id);
  if (user.role === 'bda') return summaryForBda(user.id);
  if (user.role === 'sales') return summaryForSales(user.id);
  if (user.role === 'recruiter') return summaryForRecruiter(user.id);
  return summaryForAdmin(department_id);
}

module.exports = { getSummary };
