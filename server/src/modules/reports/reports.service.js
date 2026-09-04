const prisma = require('../../config/db');
const { STUCK_THRESHOLD_DAYS } = require('../../config/constants');
const { ROUND_TYPES, computeMissingMandatoryRounds } = require('../submissions/stageMachines');

function daysBetween(from, to) {
  return (new Date(to) - new Date(from)) / 86400000;
}

/** Build a Prisma date filter from optional YYYY-MM-DD (or ISO) strings; end day inclusive. */
function optionalDateRange(date_from, date_to) {
  const range = {};
  if (date_from) range.gte = new Date(date_from);
  if (date_to) {
    const to = new Date(date_to);
    if (typeof date_to === 'string' && date_to.length <= 10) to.setHours(23, 59, 59, 999);
    range.lte = to;
  }
  return Object.keys(range).length ? range : undefined;
}

function averageDays(values) {
  if (!values.length) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

function firstArrivalAt(historyAsc, stage) {
  const row = historyAsc.find((h) => h.to_stage === stage);
  return row ? row.changed_at : null;
}

function computeRecruiterCycleAverages(submissions, historyBySubmission, firstRoundBySubmission) {
  const sourcedToSubmitted = [];
  const submittedToInterview = [];
  const interviewToOffer = [];
  const offerToClosed = [];
  const totalCycle = [];

  for (const submission of submissions) {
    const history = historyBySubmission.get(submission.id) || [];
    const submittedAt = firstArrivalAt(history, 'submitted_to_client');
    const interviewAt =
      firstArrivalAt(history, 'interview_scheduled') ||
      firstArrivalAt(history, 'interview_result') ||
      firstRoundBySubmission.get(submission.id) ||
      null;
    const offerAt = firstArrivalAt(history, 'offer_sent');
    const closedAt = firstArrivalAt(history, 'closed') || submission.actual_joining_date;

    if (submittedAt) sourcedToSubmitted.push(daysBetween(submission.created_at, submittedAt));
    if (submittedAt && interviewAt) submittedToInterview.push(daysBetween(submittedAt, interviewAt));
    if (interviewAt && offerAt) interviewToOffer.push(daysBetween(interviewAt, offerAt));
    if (offerAt && closedAt) offerToClosed.push(daysBetween(offerAt, closedAt));
    if (closedAt) totalCycle.push(daysBetween(submission.created_at, closedAt));
  }

  return {
    avg_days_sourced_to_submitted: averageDays(sourcedToSubmitted),
    avg_days_submitted_to_interview: averageDays(submittedToInterview),
    avg_days_interview_to_offer: averageDays(interviewToOffer),
    avg_days_offer_to_closed: averageDays(offerToClosed),
    avg_days_total_cycle: averageDays(totalCycle),
  };
}

async function loadSubmissionTimingMaps(submissionIds) {
  if (!submissionIds.length) {
    return { historyBySubmission: new Map(), firstRoundBySubmission: new Map() };
  }

  const [historyRows, roundRows] = await Promise.all([
    prisma.stageHistory.findMany({
      where: { entity_type: 'submission', entity_id: { in: submissionIds } },
      orderBy: { changed_at: 'asc' },
    }),
    prisma.interviewRound.findMany({
      where: { submission_id: { in: submissionIds } },
      orderBy: { round_number: 'asc' },
    }),
  ]);

  const historyBySubmission = new Map();
  for (const row of historyRows) {
    if (!historyBySubmission.has(row.entity_id)) historyBySubmission.set(row.entity_id, []);
    historyBySubmission.get(row.entity_id).push(row);
  }

  const firstRoundBySubmission = new Map();
  for (const round of roundRows) {
    if (!firstRoundBySubmission.has(round.submission_id)) {
      firstRoundBySubmission.set(round.submission_id, round.scheduled_at || round.completed_at);
    }
  }

  return { historyBySubmission, firstRoundBySubmission };
}

function summarizeInterviewRounds(rounds, from, to) {
  const inPeriod = rounds.filter((r) => {
    const anchor = r.completed_at || r.scheduled_at;
    if (!anchor) return true;
    const t = new Date(anchor);
    return t >= from && t <= to;
  });

  const completed = inPeriod.filter((r) => r.result !== 'pending');
  const pending = inPeriod.filter((r) => r.result === 'pending');
  const withFeedback = inPeriod.filter((r) => r.feedback && r.feedback.trim().length > 0);
  const ratings = inPeriod.map((r) => r.rating).filter((n) => n != null);
  const turnaroundDays = completed
    .filter((r) => r.scheduled_at && r.completed_at)
    .map((r) => daysBetween(r.scheduled_at, r.completed_at));

  const by_type = ROUND_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
  const by_result = { pending: 0, pass: 0, fail: 0, no_show: 0, rescheduled: 0 };
  for (const r of inPeriod) {
    if (by_type[r.round_type] !== undefined) by_type[r.round_type] += 1;
    if (by_result[r.result] !== undefined) by_result[r.result] += 1;
  }

  return {
    interviews_total: inPeriod.length,
    interviews_completed: completed.length,
    interviews_pending: pending.length,
    interviews_internal: by_type.internal_r1 + by_type.internal_r2,
    interviews_client: by_type.client_r1 + by_type.client_r2 + by_type.client_r3 + by_type.hr_cto_ceo,
    interviews_by_type: by_type,
    interviews_by_result: by_result,
    interviews_with_feedback: withFeedback.length,
    interviews_missing_feedback: completed.filter((r) => !r.feedback || !r.feedback.trim()).length,
    avg_interview_rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null,
    avg_days_interview_turnaround: averageDays(turnaroundDays),
  };
}

async function recruiterPerformance({ date_from, date_to, recruiter_id, department_id }) {
  const recruiters = await prisma.user.findMany({
    where: {
      role: 'recruiter',
      ...(recruiter_id ? { id: recruiter_id } : {}),
      ...(department_id ? { department_id } : {}),
    },
  });

  const from = new Date(date_from);
  const to = new Date(date_to);
  // Include full end day when date_to is YYYY-MM-DD
  if (typeof date_to === 'string' && date_to.length <= 10) to.setHours(23, 59, 59, 999);

  return Promise.all(
    recruiters.map(async (r) => {
      const profiles = await prisma.profile.findMany({
        where: { added_by: r.id, created_at: { gte: from, lte: to } },
      });
      const sourceMap = profiles.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      }, {});

      const submissions = await prisma.submission.findMany({
        where: { submitted_by: r.id, created_at: { gte: from, lte: to } },
        include: { seat: { select: { requirement_id: true } } },
      });

      const byStage = submissions.reduce((acc, s) => {
        acc[s.stage] = (acc[s.stage] || 0) + 1;
        return acc;
      }, {});

      const closures = submissions.filter(
        (s) => s.actual_joining_date && s.actual_joining_date >= from && s.actual_joining_date <= to
      );
      const backouts = submissions.filter((s) => s.stage === 'backout').length;
      const requirementIds = new Set(submissions.map((s) => s.seat.requirement_id));

      const submissionIds = (
        await prisma.submission.findMany({ where: { submitted_by: r.id }, select: { id: true } })
      ).map((s) => s.id);

      const rounds = submissionIds.length
        ? await prisma.interviewRound.findMany({ where: { submission_id: { in: submissionIds } } })
        : [];
      const interviewStats = summarizeInterviewRounds(rounds, from, to);

      const roundsBySubmission = rounds.reduce((acc, round) => {
        if (!acc.has(round.submission_id)) acc.set(round.submission_id, []);
        acc.get(round.submission_id).push(round);
        return acc;
      }, new Map());
      const rounds_missing_mandatory_count = submissions.filter(
        (s) => computeMissingMandatoryRounds(roundsBySubmission.get(s.id) || []).length > 0
      ).length;

      const { historyBySubmission, firstRoundBySubmission } = await loadSubmissionTimingMaps(
        submissions.map((s) => s.id)
      );
      const cycleAverages = computeRecruiterCycleAverages(submissions, historyBySubmission, firstRoundBySubmission);

      const closureRate = submissions.length
        ? Number(((closures.length / submissions.length) * 100).toFixed(2))
        : 0;

      return {
        recruiter: { id: r.id, name: r.name },
        profiles_sourced: profiles.length,
        profiles_sourced_by_source: {
          direct: sourceMap.direct || 0,
          vendor: sourceMap.vendor || 0,
          linkedin: sourceMap.linkedin || 0,
        },
        submissions_total: submissions.length,
        submissions_in_screening: byStage.internal_screening || 0,
        submissions_submitted_to_client: byStage.submitted_to_client || 0,
        submissions_in_interview: (byStage.interview_scheduled || 0) + (byStage.interview_result || 0),
        submissions_in_offer: byStage.offer_sent || 0,
        submissions_in_bgv: byStage.bgv || 0,
        submissions_closed: byStage.closed || 0,
        submissions_rejected: byStage.rejected || 0,
        submissions_backout: backouts,
        backout_rate_percentage: submissions.length ? Number(((backouts / submissions.length) * 100).toFixed(2)) : 0,
        ...cycleAverages,
        ...interviewStats,
        rounds_missing_mandatory_count,
        requirements_worked_on: requirementIds.size,
        closures_count: closures.length,
        closure_rate_percentage: closureRate,
      };
    })
  );
}

async function salesPerformance({ date_from, date_to, sales_id, department_id }) {
  const salesUsers = await prisma.user.findMany({
    where: {
      role: 'sales',
      ...(sales_id ? { id: sales_id } : {}),
      ...(department_id ? { department_id } : {}),
    },
  });
  const from = new Date(date_from);
  const to = new Date(date_to);
  if (typeof date_to === 'string' && date_to.length <= 10) to.setHours(23, 59, 59, 999);

  return Promise.all(
    salesUsers.map(async (s) => {
      const requirements = await prisma.requirement.findMany({
        where: { sales_owner_id: s.id, created_at: { gte: from, lte: to } },
      });
      const requirements_closed = requirements.filter((r) => r.status === 'closed');
      const requirements_dropped = requirements.filter((r) => r.status === 'dropped').length;
      const requirements_in_progress = requirements.filter((r) => r.status === 'in_progress').length;

      const allOwnedReqIds = (
        await prisma.requirement.findMany({ where: { sales_owner_id: s.id }, select: { id: true } })
      ).map((r) => r.id);

      const closedSubmissions = requirements_closed.length
        ? await prisma.submission.findMany({
            where: { seat: { requirement_id: { in: requirements_closed.map((r) => r.id) } }, stage: 'closed' },
          })
        : [];

      const periodClosures = allOwnedReqIds.length
        ? await prisma.submission.findMany({
            where: {
              seat: { requirement_id: { in: allOwnedReqIds } },
              actual_joining_date: { gte: from, lte: to },
            },
          })
        : [];

      const rounds = allOwnedReqIds.length
        ? await prisma.interviewRound.findMany({
            where: { submission: { seat: { requirement_id: { in: allOwnedReqIds } } } },
          })
        : [];
      const interviewStats = summarizeInterviewRounds(rounds, from, to);

      const ownedSubmissions = allOwnedReqIds.length
        ? await prisma.submission.findMany({
            where: {
              seat: { requirement_id: { in: allOwnedReqIds } },
              stage: { notIn: ['backout', 'rejected'] },
            },
            select: { id: true },
          })
        : [];
      const roundTypesBySubmission = rounds.reduce((acc, round) => {
        if (!acc.has(round.submission_id)) acc.set(round.submission_id, new Set());
        acc.get(round.submission_id).add(round.round_type);
        return acc;
      }, new Map());
      const submissions_missing_hr_cto_ceo_round = ownedSubmissions.filter(
        (s) => !(roundTypesBySubmission.get(s.id) || new Set()).has('hr_cto_ceo')
      ).length;

      const total_closed_revenue = closedSubmissions.reduce((sum, x) => sum + Number(x.final_agreed_rate || 0), 0);
      const total_margin_generated = closedSubmissions.reduce((sum, x) => sum + Number(x.margin || 0), 0);

      const openRequirements = requirements.filter((r) => r.status === 'open' || r.status === 'in_progress');
      const total_budget_pipeline = openRequirements.reduce((sum, r) => sum + Number(r.budget_max || 0), 0);

      // Active clients linked via requirements this person owns (not BDA lead ownership).
      const clientIds = [
        ...new Set(
          (
            await prisma.requirement.findMany({
              where: { sales_owner_id: s.id, account: { type: 'client' } },
              select: { account_id: true },
            })
          ).map((r) => r.account_id)
        ),
      ];
      const clients_active = clientIds.length
        ? await prisma.account.count({ where: { id: { in: clientIds }, stage: 'active' } })
        : 0;

      // Anchored on closed_at falling in the period (same closure-event window as periodClosures),
      // not on created_at — a requirement opened long before the period can still close within it.
      // status: 'closed' excludes dropped requirements, which also stamp closed_at.
      const closedInPeriod = await prisma.requirement.findMany({
        where: { sales_owner_id: s.id, status: 'closed', closed_at: { gte: from, lte: to } },
      });
      let avg_closure_days = null;
      if (closedInPeriod.length) {
        const days = closedInPeriod.map((r) => (new Date(r.closed_at) - new Date(r.created_at)) / 86400000);
        avg_closure_days = Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1));
      }

      return {
        sales_person: { id: s.id, name: s.name },
        requirements_opened: requirements.length,
        requirements_closed: requirements_closed.length,
        requirements_dropped,
        requirements_in_progress,
        avg_closure_days,
        total_budget_pipeline,
        total_closed_revenue,
        total_margin_generated,
        clients_active,
        closures_count: periodClosures.length,
        ...interviewStats,
        submissions_missing_hr_cto_ceo_round,
      };
    })
  );
}

/**
 * BDA lead/account funnel. Leads are owned by BDA (owner_id), not sales.
 * "Brought"/funnel metrics credit origin_owner_id (immutable — who first added the
 * client/vendor). The *_current snapshots credit owner_id (the present POC), so a
 * reassigned account moves in the snapshot but the origin BDA keeps the acquisition credit.
 */
async function bdaPerformance({ date_from, date_to, bda_id, department_id }) {
  const bdaUsers = await prisma.user.findMany({
    where: {
      role: 'bda',
      ...(bda_id ? { id: bda_id } : {}),
      ...(department_id ? { department_id } : {}),
    },
  });
  const from = new Date(date_from);
  const to = new Date(date_to);
  if (typeof date_to === 'string' && date_to.length <= 10) to.setHours(23, 59, 59, 999);
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 86400000);

  return Promise.all(
    bdaUsers.map(async (b) => {
      const ownedInRange = await prisma.account.findMany({
        where: {
          OR: [{ origin_owner_id: b.id }, { origin_owner_id: null, owner_id: b.id }],
          created_at: { gte: from, lte: to },
        },
      });
      const clientLeads = ownedInRange.filter((a) => a.type === 'client');
      const vendorLeads = ownedInRange.filter((a) => a.type === 'vendor');
      const unclassifiedLeads = ownedInRange.filter((a) => a.type == null);

      const leads_created = clientLeads.length;
      const leads_in_meeting = clientLeads.filter((a) => a.stage === 'meeting_scheduled' || a.stage === 'rescheduled').length;
      const leads_converted_active = clientLeads.filter((a) => a.stage === 'active').length;
      const leads_dropped = clientLeads.filter((a) => a.stage === 'dropped').length;
      const leads_unclassified = unclassifiedLeads.length;
      const leads_via_linkedin = ownedInRange.filter((a) => !!a.linkedin_url).length;

      const meetingDays = ownedInRange
        .filter((a) => a.created_at && a.meeting_date)
        .map((a) => daysBetween(a.created_at, a.meeting_date));
      const avg_days_lead_to_meeting = averageDays(meetingDays);

      // Snapshot counts "as of now" — intentionally NOT scoped to date_from/date_to like the
      // fields above, since "currently active clients" is a present-state fact, not a period
      // event. Named *_current so the report doesn't imply they're period-scoped.
      const clients_active_current = await prisma.account.count({
        where: { owner_id: b.id, type: 'client', stage: 'active' },
      });
      const vendors_active_current = await prisma.account.count({
        where: { owner_id: b.id, type: 'vendor', stage: 'active' },
      });
      const stuck_leads_current = await prisma.account.count({
        where: {
          owner_id: b.id,
          type: 'client',
          stage: { in: ['lead', 'meeting_scheduled', 'rescheduled'] },
          updated_at: { lte: stuckCutoff },
        },
      });

      return {
        bda: { id: b.id, name: b.name },
        leads_created,
        leads_in_meeting,
        leads_converted_active,
        leads_dropped,
        conversion_rate_percentage: leads_created
          ? Number(((leads_converted_active / leads_created) * 100).toFixed(2))
          : 0,
        vendors_created: vendorLeads.length,
        leads_unclassified,
        leads_via_linkedin,
        avg_days_lead_to_meeting,
        clients_active_current,
        vendors_active_current,
        stuck_leads_current,
      };
    })
  );
}

async function vendorPerformance({ date_from, date_to, vendor_id }) {
  const vendors = await prisma.account.findMany({ where: { type: 'vendor', ...(vendor_id ? { id: vendor_id } : {}) } });
  const from = new Date(date_from);
  const to = new Date(date_to);

  return Promise.all(
    vendors.map(async (v) => {
      const submissions = await prisma.submission.findMany({
        where: { profile: { vendor_account_id: v.id }, created_at: { gte: from, lte: to } },
        include: { seat: { include: { requirement: { select: { created_at: true } } } } },
      });

      const shortlisted = submissions.filter((s) => !['sourced', 'internal_screening'].includes(s.stage)).length;
      const interviewed = submissions.filter((s) => ['interview_scheduled', 'interview_result', 'offer_sent', 'bgv', 'closed'].includes(s.stage)).length;
      const offered = submissions.filter((s) => ['offer_sent', 'bgv', 'closed'].includes(s.stage)).length;
      const closed = submissions.filter((s) => s.stage === 'closed');
      const backout = submissions.filter((s) => s.stage === 'backout').length;

      const margins = closed.map((s) => Number(s.margin || 0));
      const total_margin = margins.reduce((a, b) => a + b, 0);
      const daysToSubmit = submissions.map((s) => daysBetween(s.seat.requirement.created_at, s.created_at));

      return {
        vendor: { id: v.id, name: v.name },
        profiles_submitted: submissions.length,
        profiles_shortlisted: shortlisted,
        profiles_interviewed: interviewed,
        profiles_offered: offered,
        profiles_closed: closed.length,
        profiles_backout: backout,
        backout_rate_percentage: submissions.length ? Number(((backout / submissions.length) * 100).toFixed(2)) : 0,
        avg_margin_per_profile: closed.length ? Number((total_margin / closed.length).toFixed(2)) : 0,
        total_margin,
        avg_days_to_submit: averageDays(daysToSubmit),
        reliability_score: submissions.length ? Number(((closed.length / submissions.length) * 100).toFixed(2)) : null,
      };
    })
  );
}

async function clientPerformance({ date_from, date_to, client_id }) {
  const clients = await prisma.account.findMany({ where: { type: 'client', ...(client_id ? { id: client_id } : {}) } });
  const from = new Date(date_from);
  const to = new Date(date_to);
  if (typeof date_to === 'string' && date_to.length <= 10) to.setHours(23, 59, 59, 999);
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 86400000);

  return Promise.all(
    clients.map(async (c) => {
      const requirements = await prisma.requirement.findMany({
        where: { account_id: c.id, created_at: { gte: from, lte: to } },
      });
      const requirementIds = requirements.map((r) => r.id);

      const allReqIds = (
        await prisma.requirement.findMany({ where: { account_id: c.id }, select: { id: true } })
      ).map((r) => r.id);

      const submissions = requirementIds.length
        ? await prisma.submission.findMany({
            where: { seat: { requirement_id: { in: requirementIds } } },
          })
        : [];
      const closedSubmissions = submissions.filter((s) => s.stage === 'closed');

      const total_revenue = closedSubmissions.reduce((sum, s) => sum + Number(s.final_agreed_rate || 0), 0);
      const total_margin = closedSubmissions.reduce((sum, s) => sum + Number(s.margin || 0), 0);
      const closureDays = closedSubmissions
        .filter((s) => s.actual_joining_date)
        .map((s) => daysBetween(s.created_at, s.actual_joining_date));

      const stuck_requirements_count = allReqIds.length
        ? await prisma.requirement.count({
            where: {
              id: { in: allReqIds },
              status: { in: ['open', 'in_progress'] },
              updated_at: { lte: stuckCutoff },
            },
          })
        : 0;

      return {
        client: { id: c.id, name: c.name },
        requirements_total: requirements.length,
        requirements_open: requirements.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
        requirements_closed: requirements.filter((r) => r.status === 'closed').length,
        submissions_total: submissions.length,
        submissions_closed: closedSubmissions.length,
        avg_days_to_close: averageDays(closureDays),
        total_revenue,
        total_margin,
        stuck_requirements_count,
      };
    })
  );
}

async function aging({ threshold_days = STUCK_THRESHOLD_DAYS, department_id }) {
  const cutoff = new Date(Date.now() - threshold_days * 86400000);
  const ownerDept = department_id ? { owner: { department_id } } : {};
  const salesDept = department_id ? { sales_owner: { department_id } } : {};
  const recruiterDept = department_id ? { submitted_by_user: { department_id } } : {};

  const stuckLeadsRaw = await prisma.account.findMany({
    where: {
      stage: { in: ['lead', 'meeting_scheduled', 'rescheduled'] },
      updated_at: { lte: cutoff },
      ...ownerDept,
    },
    include: {
      owner: { select: { id: true, name: true } },
      requirements: { select: { id: true } },
    },
  });

  const stuckReqsRaw = await prisma.requirement.findMany({
    where: { status: { in: ['open', 'in_progress'] }, updated_at: { lte: cutoff }, ...salesDept },
    include: {
      sales_owner: { select: { id: true, name: true } },
      account: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, name: true } },
        },
      },
      seats: { select: { id: true } },
      assignments: {
        where: { role_on_req: 'recruiter', unassigned_at: null },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  const allSeatIds = stuckReqsRaw.flatMap((r) => r.seats.map((s) => s.id));
  const submissionAgg = allSeatIds.length
    ? await prisma.submission.groupBy({
        by: ['requirement_seat_id'],
        where: { requirement_seat_id: { in: allSeatIds } },
        _count: { _all: true },
        _max: { created_at: true, updated_at: true },
      })
    : [];
  const seatAggById = new Map(submissionAgg.map((row) => [row.requirement_seat_id, row]));

  const stuckReqs = stuckReqsRaw.map((r) => {
    const seatStats = r.seats.map((seat) => seatAggById.get(seat.id)).filter(Boolean);
    const submissions_count = seatStats.reduce((sum, row) => sum + row._count._all, 0);
    const last_submission_date = seatStats.reduce((latest, row) => {
      const stamp = row._max.created_at;
      if (!stamp) return latest;
      if (!latest) return stamp;
      return new Date(stamp) > new Date(latest) ? stamp : latest;
    }, null);
    const lastActivity = last_submission_date || r.updated_at || r.created_at;
    return {
      requirement: {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        sla_days: r.sla_days,
      },
      client: r.account ? { id: r.account.id, name: r.account.name } : null,
      bda: r.account?.owner ? { id: r.account.owner.id, name: r.account.owner.name } : null,
      sales_owner: r.sales_owner,
      recruiters: r.assignments.map((a) => ({ id: a.user.id, name: a.user.name })),
      days_open: Math.floor((Date.now() - new Date(r.created_at)) / 86400000),
      days_since_last_activity: Math.floor((Date.now() - new Date(lastActivity)) / 86400000),
      submissions_count,
      last_submission_date,
    };
  });

  const stuckSubmissionsRaw = await prisma.submission.findMany({
    where: {
      stage: { notIn: ['closed', 'rejected', 'backout'] },
      updated_at: { lte: cutoff },
      ...recruiterDept,
    },
    include: {
      profile: { select: { id: true, name: true } },
      seat: {
        include: {
          requirement: {
            select: {
              id: true,
              title: true,
              sales_owner: { select: { id: true, name: true } },
              account: {
                select: {
                  id: true,
                  name: true,
                  owner: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      submitted_by_user: { select: { id: true, name: true } },
    },
  });

  const pastSlaRaw = await prisma.requirement.findMany({
    where: {
      sla_days: { not: null },
      status: { in: ['open', 'in_progress'] },
      ...salesDept,
    },
    include: {
      sales_owner: { select: { id: true, name: true } },
      account: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, name: true } },
        },
      },
      assignments: {
        where: { role_on_req: 'recruiter', unassigned_at: null },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return {
    stuck_leads: stuckLeadsRaw.map((l) => ({
      account: { id: l.id, name: l.name, stage: l.stage },
      owner: l.owner,
      bda: l.owner,
      requirements_count: l.requirements.length,
      days_in_stage: Math.floor((Date.now() - new Date(l.updated_at)) / 86400000),
      last_activity: l.updated_at,
    })),
    stuck_requirements: stuckReqs,
    stuck_submissions: stuckSubmissionsRaw.map((s) => ({
      submission: { id: s.id, stage: s.stage },
      profile: s.profile,
      requirement: { id: s.seat.requirement.id, title: s.seat.requirement.title },
      client: s.seat.requirement.account
        ? { id: s.seat.requirement.account.id, name: s.seat.requirement.account.name }
        : null,
      bda: s.seat.requirement.account?.owner
        ? { id: s.seat.requirement.account.owner.id, name: s.seat.requirement.account.owner.name }
        : null,
      sales_owner: s.seat.requirement.sales_owner,
      recruiter: s.submitted_by_user,
      days_in_current_stage: Math.floor((Date.now() - new Date(s.updated_at)) / 86400000),
    })),
    past_sla_requirements: pastSlaRaw
      .map((r) => {
        const days_open = Math.floor((Date.now() - new Date(r.created_at)) / 86400000);
        return {
          requirement: { id: r.id, title: r.title, sla_days: r.sla_days, priority: r.priority },
          client: r.account ? { id: r.account.id, name: r.account.name } : null,
          bda: r.account?.owner ? { id: r.account.owner.id, name: r.account.owner.name } : null,
          sales_owner: r.sales_owner,
          recruiters: r.assignments.map((a) => ({ id: a.user.id, name: a.user.name })),
          days_open,
          overdue_by_days: days_open - r.sla_days,
        };
      })
      .filter((r) => r.overdue_by_days > 0),
  };
}

async function closure({ date_from, date_to, group_by = 'month', department_id }) {
  const rows = await prisma.submission.findMany({
    where: {
      stage: 'closed',
      actual_joining_date: { gte: new Date(date_from), lte: new Date(date_to) },
      ...(department_id ? { submitted_by_user: { department_id } } : {}),
    },
    include: {
      seat: { include: { requirement: { include: { account: { select: { id: true, name: true } } } } } },
      profile: { select: { id: true, name: true } },
      submitted_by_user: { select: { id: true, name: true } },
    },
  });

  const groupKey = (row) => {
    const d = new Date(row.actual_joining_date);
    if (group_by === 'client') return row.seat.requirement.account.name;
    if (group_by === 'recruiter') return row.submitted_by_user.name;
    if (group_by === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([group_label, items]) => {
    const total_revenue = items.reduce((s, x) => s + Number(x.final_agreed_rate || 0), 0);
    const total_margin = items.reduce((s, x) => s + Number(x.margin || 0), 0);
    const cycles = items.map((x) => (new Date(x.actual_joining_date) - new Date(x.created_at)) / 86400000);
    const avg_cycle_days = cycles.length ? Number((cycles.reduce((a, b) => a + b, 0) / cycles.length).toFixed(1)) : 0;

    return {
      group_label,
      closures_count: items.length,
      total_revenue,
      total_margin,
      avg_cycle_days,
      details: items.map((x) => ({
        requirement: { id: x.seat.requirement.id, title: x.seat.requirement.title },
        client: x.seat.requirement.account,
        profile: x.profile,
        joined_at: x.actual_joining_date,
        final_agreed_rate: x.final_agreed_rate,
        margin: x.margin,
        recruiter: x.submitted_by_user,
      })),
    };
  });
}

// Requirement statuses that count as "active work" for the coverage buckets.
const ACTIVE_REQUIREMENT_STATUSES = ['open', 'in_progress', 'on_hold'];

/**
 * Active client coverage report (UI: "Clients without requirements").
 *
 * With a `bucket` (the report UI) this is "active-stage clients":
 * `type = 'client'`, `stage = 'active'`, split by their current requirement mix:
 *   - `all` — every active-stage client, no requirement filter.
 *   - `with_requirements` ("Has requirements") — ≥1 requirement open / in_progress
 *     / on_hold (closed / dropped do not count).
 *   - `no_active` ("No requirements") — no requirement open / in_progress /
 *     on_hold: closed / dropped only, or never had one.
 *   - `without_active_requirements` / `closed_only` — kept for the export route
 *     and back-compat; not surfaced in the UI.
 * Legacy callers with no bucket keep the old behaviour: no requirement rows, and
 * unclassified (`type IS NULL`) accounts are included so `stage = 'lead'` works.
 */
async function clientsWithoutRequirements({ bda_id, origin_owner_id, stage, bucket, date_from, date_to }) {
  const effectiveStage = bucket ? (stage || 'active') : stage;
  const createdRange = optionalDateRange(date_from, date_to);
  const baseWhere = {
    // Report UI ("active-stage clients") is strictly `type = 'client'`. The
    // legacy no-bucket path keeps unclassified accounts so `stage = 'lead'`
    // still returns not-yet-classified leads.
    ...(bucket ? { type: 'client' } : { OR: [{ type: 'client' }, { type: null }] }),
    ...(bda_id ? { owner_id: bda_id } : {}),
    ...(origin_owner_id ? { origin_owner_id } : {}),
    ...(effectiveStage ? { stage: effectiveStage } : {}),
    ...(createdRange ? { created_at: createdRange } : {}),
  };

  let requirementFilter;
  if (bucket === 'all') {
    requirementFilter = {};
  } else if (bucket === 'with_requirements') {
    requirementFilter = { requirements: { some: { status: { in: ACTIVE_REQUIREMENT_STATUSES } } } };
  } else if (bucket === 'no_active') {
    requirementFilter = { requirements: { none: { status: { in: ACTIVE_REQUIREMENT_STATUSES } } } };
  } else if (bucket === 'closed_only') {
    requirementFilter = {
      AND: [
        { requirements: { some: {} } },
        { requirements: { none: { status: { in: ACTIVE_REQUIREMENT_STATUSES } } } },
      ],
    };
  } else if (bucket === 'without_active_requirements') {
    requirementFilter = { requirements: { none: {} } };
  } else {
    // Legacy default (no bucket): no requirements at all.
    requirementFilter = { requirements: { none: {} } };
  }

  const rows = await prisma.account.findMany({
    where: { ...baseWhere, ...requirementFilter },
    include: {
      owner: { select: { id: true, name: true } },
      origin_owner: { select: { id: true, name: true } },
      _count: { select: { requirements: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((a) => ({
    client: { id: a.id, name: a.name },
    stage: a.stage,
    brought_by: a.origin_owner ? { id: a.origin_owner.id, name: a.origin_owner.name } : null,
    sales_poc: a.owner ? { id: a.owner.id, name: a.owner.name } : null,
    requirements_count: a._count.requirements,
    created_at: a.created_at,
    days_idle: Math.floor(daysBetween(a.created_at, new Date())),
  }));
}

// A candidate is "in a live submission" while its submission stage is anything
// other than a terminal one — i.e. still in flight against some requirement.
const LIVE_SUBMISSION_STAGES = [
  'sourced',
  'internal_screening',
  'submitted_to_client',
  'interview_scheduled',
  'interview_result',
  'offer_sent',
  'bgv',
];

/**
 * One row per vendor account (`type = 'vendor'`, `stage = 'active'`), carrying
 * the vendor's POC from our end (`account.owner`), "brought by"
 * (`account.origin_owner`), every recruiter who has sourced a profile from it,
 * `profiles_sourced` / `profiles_submitted`, and `has_live_submission` — whether
 * any sourced candidate currently sits in a non-terminal submission stage.
 *
 * Filters:
 *   - `vendor_id` — a single vendor account.
 *   - `owner_id` — the vendor's POC from our end (`account.owner_id`).
 *   - `origin_owner_id` — who brought the vendor in.
 *   - `recruiter_id` — keep only vendors this user has sourced ≥1 profile from
 *     (the route also forces this to the caller for the recruiter role).
 *   - `date_from` / `date_to` — scope the sourced-profile counts by profile
 *     created date.
 *   - `vendor_activity`:
 *       `active` (default) — every active-stage vendor.
 *       `inactive` — no sourced candidate is currently in a live submission.
 */
async function recruiterVendorGaps({
  recruiter_id, vendor_id, owner_id, origin_owner_id, vendor_activity, date_from, date_to,
}) {
  const sourcedRange = optionalDateRange(date_from, date_to);

  const vendors = await prisma.account.findMany({
    where: {
      AND: [
        { type: 'vendor' },
        { stage: 'active' },
        ...(vendor_id ? [{ id: vendor_id }] : []),
        ...(owner_id ? [{ owner_id }] : []),
        ...(origin_owner_id ? [{ origin_owner_id }] : []),
      ],
    },
    include: {
      owner: { select: { id: true, name: true } },
      origin_owner: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = await Promise.all(
    vendors.map(async (v) => {
      const profiles = await prisma.profile.findMany({
        where: {
          vendor_account_id: v.id,
          ...(sourcedRange ? { created_at: sourcedRange } : {}),
        },
        select: {
          id: true,
          created_at: true,
          added_by_user: { select: { id: true, name: true } },
          submissions: { select: { stage: true } },
        },
      });

      const submittedCount = profiles.filter((p) => p.submissions.length > 0).length;
      const has_live_submission = profiles.some((p) =>
        p.submissions.some((s) => LIVE_SUBMISSION_STAGES.includes(s.stage))
      );
      const recruiters = [
        ...new Map(
          profiles.filter((p) => p.added_by_user).map((p) => [p.added_by_user.id, p.added_by_user])
        ).values(),
      ];
      const last_sourced_at = profiles.reduce(
        (latest, p) => (!latest || p.created_at > latest ? p.created_at : latest),
        null
      );

      return {
        vendor: { id: v.id, name: v.name },
        our_poc: v.owner ? { id: v.owner.id, name: v.owner.name } : null,
        brought_by: v.origin_owner ? { id: v.origin_owner.id, name: v.origin_owner.name } : null,
        recruiters: recruiters.map((r) => ({ id: r.id, name: r.name })),
        profiles_sourced: profiles.length,
        profiles_submitted: submittedCount,
        has_live_submission,
        last_sourced_at,
        days_since_sourced: last_sourced_at
          ? Math.floor(daysBetween(last_sourced_at, new Date()))
          : null,
      };
    })
  );

  return rows
    .filter((r) => !recruiter_id || r.recruiters.some((x) => x.id === recruiter_id))
    // `active` (default) = every active-stage vendor; `inactive` = no live candidate.
    .filter((r) => vendor_activity !== 'inactive' || !r.has_live_submission)
    .sort((a, b) => (b.days_since_sourced ?? -1) - (a.days_since_sourced ?? -1));
}

module.exports = {
  recruiterPerformance,
  salesPerformance,
  bdaPerformance,
  vendorPerformance,
  clientPerformance,
  aging,
  closure,
  clientsWithoutRequirements,
  recruiterVendorGaps,
};
