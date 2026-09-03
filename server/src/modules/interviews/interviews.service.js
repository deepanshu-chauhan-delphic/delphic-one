const prisma = require('../../config/db');
const { ROUND_TYPE_LABELS, roundTypeLabel } = require('../submissions/stageMachines');
const { canManageInterviewRound } = require('../submissions/submissions.service');
const {
  notify,
  interviewRoundParticipants,
  submissionParticipants,
  isAssignedInterviewer,
} = require('../../lib/notifications');

const CALENDAR_INCLUDE = {
  submission: {
    select: {
      id: true,
      submitted_by: true,
      profile: { select: { id: true, name: true } },
      seat: {
        select: {
          requirement: {
            select: { id: true, title: true, sales_owner_id: true, account: { select: { name: true } } },
          },
        },
      },
    },
  },
  interviewers: { include: { user: { select: { id: true, name: true, email: true } } } },
};

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function canSubmitFeedbackFor(round, user) {
  const submission = round.submission;
  if (!submission) return false;
  const salesOwnerId = submission.seat?.requirement?.sales_owner_id ?? null;
  if (canManageInterviewRound(submission, salesOwnerId, round.round_type, user)) return true;
  return (round.interviewers || []).some((i) => i.user_id === user.id);
}

function serializeCalendarEvent(round, user) {
  const submission = round.submission || {};
  const requirement = submission.seat?.requirement || {};
  const startsAt = round.scheduled_at;
  const endsAt = startsAt && round.duration_minutes
    ? new Date(new Date(startsAt).getTime() + round.duration_minutes * 60000)
    : null;
  const interviewers = (round.interviewers || []).map((i) => ({ id: i.user.id, name: i.user.name, email: i.user.email }));
  return {
    id: round.id,
    submission_id: round.submission_id,
    scheduled_at: startsAt,
    duration_minutes: round.duration_minutes,
    ends_at: endsAt,
    status: round.status,
    round_type: round.round_type,
    round_type_label: ROUND_TYPE_LABELS[round.round_type] || round.round_type,
    round_name: round.round_name,
    result: round.result,
    meeting_link: round.meeting_link,
    candidate_name: submission.profile?.name || null,
    requirement_id: requirement.id || null,
    requirement_title: requirement.title || null,
    account_name: requirement.account?.name || null,
    interviewers,
    interviewer_name: round.interviewer_name,
    interviewer_email: round.interviewer_email,
    cancellation_reason: round.cancellation_reason,
    cancelled_at: round.cancelled_at,
    can_submit_feedback: user ? canSubmitFeedbackFor(round, user) : false,
  };
}

async function listForCalendar(user, opts = {}) {
  const def = monthRange();
  const from = opts.from ? new Date(opts.from) : def.from;
  const to = opts.to ? new Date(opts.to) : def.to;
  const mine = opts.mine === '1';

  const where = { scheduled_at: { gte: from, lte: to } };
  if (opts.status) where.status = opts.status;
  if (opts.result) where.result = opts.result;

  const scopeOr = [];
  if (mine) {
    scopeOr.push({ submission: { submitted_by: user.id } });
    scopeOr.push({ interviewers: { some: { user_id: user.id } } });
  } else if (user.role !== 'admin') {
    if (user.role === 'sales') {
      scopeOr.push({ submission: { seat: { requirement: { sales_owner_id: user.id } } } });
    } else if (user.role === 'bda') {
      scopeOr.push({ submission: { seat: { requirement: { account: { owner_id: user.id } } } } });
    } else if (user.role === 'recruiter') {
      scopeOr.push({ submission: { submitted_by: user.id } });
    }
    scopeOr.push({ interviewers: { some: { user_id: user.id } } });
  }
  if (scopeOr.length) where.OR = scopeOr;

  const rows = await prisma.interviewRound.findMany({
    where,
    include: CALENDAR_INCLUDE,
    orderBy: { scheduled_at: 'asc' },
  });
  return rows.map((r) => serializeCalendarEvent(r, user));
}

async function loadRoundForAction(client, id) {
  return client.interviewRound.findUnique({ where: { id }, include: CALENDAR_INCLUDE });
}

async function submitFeedback(id, body, user) {
  return prisma.$transaction(async (tx) => {
    const round = await loadRoundForAction(tx, id);
    if (!round) return { error: 'not_found' };

    const canManage = canSubmitFeedbackFor(round, user);
    const assigned = await isAssignedInterviewer(tx, id, user.id);
    if (!canManage && !assigned) return { error: 'forbidden' };

    const patch = {};
    if (body.result !== undefined) patch.result = body.result;
    if (body.feedback !== undefined) patch.feedback = body.feedback;
    if (body.rating !== undefined) patch.rating = body.rating;
    if (body.completed_at !== undefined) patch.completed_at = new Date(body.completed_at);
    if (['pass', 'fail', 'no_show'].includes(patch.result)) {
      patch.status = 'completed';
      if (!patch.completed_at) patch.completed_at = new Date();
    }

    await tx.interviewRound.update({ where: { id }, data: patch });
    const updated = await loadRoundForAction(tx, id);

    await notify(tx, {
      type: 'interview_feedback_submitted',
      actorId: user.id,
      recipientIds: await submissionParticipants(tx, round.submission_id),
      context: {
        actorName: user.name,
        candidateName: round.submission?.profile?.name,
        requirementTitle: round.submission?.seat?.requirement?.title,
        accountName: round.submission?.seat?.requirement?.account?.name,
        submissionId: round.submission_id,
        interviewRoundId: id,
        roundTypeLabel: roundTypeLabel(round.round_type),
        result: patch.result || round.result,
      },
    });

    return { round: serializeCalendarEvent(updated, user) };
  });
}

async function cancelRound(id, { reason }, user) {
  return prisma.$transaction(async (tx) => {
    const round = await loadRoundForAction(tx, id);
    if (!round) return { error: 'not_found' };

    const submission = round.submission;
    const salesOwnerId = submission?.seat?.requirement?.sales_owner_id ?? null;
    if (!canManageInterviewRound(submission, salesOwnerId, round.round_type, user)) return { error: 'forbidden' };
    if (round.status === 'cancelled') return { round: serializeCalendarEvent(round, user) };

    await tx.interviewRound.update({
      where: { id },
      data: { status: 'cancelled', cancelled_at: new Date(), cancellation_reason: reason },
    });
    const updated = await loadRoundForAction(tx, id);

    await notify(tx, {
      type: 'interview_cancelled',
      actorId: user.id,
      recipientIds: await interviewRoundParticipants(tx, id),
      context: {
        actorName: user.name,
        candidateName: submission?.profile?.name,
        requirementTitle: submission?.seat?.requirement?.title,
        accountName: submission?.seat?.requirement?.account?.name,
        submissionId: round.submission_id,
        interviewRoundId: id,
        roundTypeLabel: roundTypeLabel(round.round_type),
        reason,
      },
    });

    return { round: serializeCalendarEvent(updated, user) };
  });
}

module.exports = {
  listForCalendar,
  submitFeedback,
  cancelRound,
  serializeCalendarEvent,
};
