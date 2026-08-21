const prisma = require('../../config/db');

function daysBetween(from, to) {
  return (new Date(to) - new Date(from)) / 86400000;
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
    const offerAt = firstArrivalAt(history, 'offer');
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

  const by_type = { internal: 0, client_l1: 0, client_l2: 0, client_hr: 0, client_final: 0 };
  const by_result = { pending: 0, pass: 0, fail: 0, no_show: 0, rescheduled: 0 };
  for (const r of inPeriod) {
    if (by_type[r.round_type] !== undefined) by_type[r.round_type] += 1;
    if (by_result[r.result] !== undefined) by_result[r.result] += 1;
  }

  return {
    interviews_total: inPeriod.length,
    interviews_completed: completed.length,
    interviews_pending: pending.length,
    interviews_internal: by_type.internal,
    interviews_client: by_type.client_l1 + by_type.client_l2 + by_type.client_hr + by_type.client_final,
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
          internal: sourceMap.internal || 0,
          vendor: sourceMap.vendor || 0,
          linkedin: sourceMap.linkedin || 0,
        },
        submissions_total: submissions.length,
        submissions_in_screening: byStage.internal_screening || 0,
        submissions_submitted_to_client: byStage.submitted_to_client || 0,
        submissions_in_interview: (byStage.interview_scheduled || 0) + (byStage.interview_result || 0),
        submissions_in_offer: byStage.offer || 0,
        submissions_in_bgv: byStage.bgv || 0,
        submissions_closed: byStage.closed || 0,
        submissions_rejected: byStage.rejected || 0,
        submissions_backout: backouts,
        backout_rate_percentage: submissions.length ? Number(((backouts / submissions.length) * 100).toFixed(2)) : 0,
        ...cycleAverages,
        ...interviewStats,
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

      let avg_closure_days = null;
      const closedWithDates = requirements_closed.filter((r) => r.closed_at);
      if (closedWithDates.length) {
        const days = closedWithDates.map((r) => (new Date(r.closed_at) - new Date(r.created_at)) / 86400000);
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
      };
    })
  );
}

/**
 * BDA lead/account funnel. Leads are owned by BDA (owner_id), not sales.
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
  const stuckCutoff = new Date(Date.now() - 7 * 86400000);

  return Promise.all(
    bdaUsers.map(async (b) => {
      const ownedInRange = await prisma.account.findMany({
        where: { owner_id: b.id, created_at: { gte: from, lte: to } },
      });
      const clientLeads = ownedInRange.filter((a) => a.type === 'client');
      const vendorLeads = ownedInRange.filter((a) => a.type === 'vendor');

      const leads_created = clientLeads.length;
      const leads_in_meeting = clientLeads.filter((a) => a.stage === 'meeting_scheduled' || a.stage === 'rescheduled').length;
      const leads_converted_active = clientLeads.filter((a) => a.stage === 'active').length;
      const leads_dropped = clientLeads.filter((a) => a.stage === 'dropped').length;

      const clients_active = await prisma.account.count({
        where: { owner_id: b.id, type: 'client', stage: 'active' },
      });
      const vendors_active = await prisma.account.count({
        where: { owner_id: b.id, type: 'vendor', stage: 'active' },
      });
      const stuck_leads = await prisma.account.count({
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
        clients_active,
        vendors_active,
        stuck_leads_7d: stuck_leads,
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
      const interviewed = submissions.filter((s) => ['interview_scheduled', 'interview_result', 'offer', 'bgv', 'closed'].includes(s.stage)).length;
      const offered = submissions.filter((s) => ['offer', 'bgv', 'closed'].includes(s.stage)).length;
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

async function aging({ threshold_days = 7, department_id }) {
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
    include: { owner: { select: { id: true, name: true } } },
  });

  const stuckReqsRaw = await prisma.requirement.findMany({
    where: { status: { in: ['open', 'in_progress'] }, created_at: { lte: cutoff }, ...salesDept },
    include: { sales_owner: { select: { id: true, name: true } }, seats: true },
  });

  const stuckReqs = await Promise.all(
    stuckReqsRaw.map(async (r) => {
      const seatIds = r.seats.map((s) => s.id);
      const submissions_count = seatIds.length
        ? await prisma.submission.count({ where: { requirement_seat_id: { in: seatIds } } })
        : 0;
      const lastSubmission = seatIds.length
        ? await prisma.submission.findFirst({ where: { requirement_seat_id: { in: seatIds } }, orderBy: { created_at: 'desc' } })
        : null;

      return {
        requirement: { id: r.id, title: r.title, status: r.status, priority: r.priority },
        sales_owner: r.sales_owner,
        days_open: Math.floor((Date.now() - new Date(r.created_at)) / 86400000),
        submissions_count,
        last_submission_date: lastSubmission ? lastSubmission.created_at : null,
      };
    })
  );

  const stuckSubmissionsRaw = await prisma.submission.findMany({
    where: {
      stage: { notIn: ['closed', 'rejected', 'backout'] },
      updated_at: { lte: cutoff },
      ...recruiterDept,
    },
    include: {
      profile: { select: { id: true, name: true } },
      seat: { include: { requirement: { select: { id: true, title: true } } } },
      submitted_by_user: { select: { id: true, name: true } },
    },
  });

  const pastSlaRaw = await prisma.requirement.findMany({
    where: {
      sla_days: { not: null },
      status: { in: ['open', 'in_progress'] },
      ...salesDept,
    },
  });

  return {
    stuck_leads: stuckLeadsRaw.map((l) => ({
      account: { id: l.id, name: l.name, stage: l.stage },
      owner: l.owner,
      days_in_stage: Math.floor((Date.now() - new Date(l.updated_at)) / 86400000),
      last_activity: l.updated_at,
    })),
    stuck_requirements: stuckReqs,
    stuck_submissions: stuckSubmissionsRaw.map((s) => ({
      submission: { id: s.id, stage: s.stage },
      profile: s.profile,
      requirement: s.seat.requirement,
      recruiter: s.submitted_by_user,
      days_in_current_stage: Math.floor((Date.now() - new Date(s.updated_at)) / 86400000),
    })),
    past_sla_requirements: pastSlaRaw
      .map((r) => {
        const days_open = Math.floor((Date.now() - new Date(r.created_at)) / 86400000);
        return { requirement: { id: r.id, title: r.title, sla_days: r.sla_days }, days_open, overdue_by_days: days_open - r.sla_days };
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

module.exports = { recruiterPerformance, salesPerformance, bdaPerformance, vendorPerformance, aging, closure };
