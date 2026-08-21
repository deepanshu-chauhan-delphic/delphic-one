const prisma = require('../../config/db');
const { SUBMISSION_STAGE_TRANSITIONS, computeMargin } = require('./stageMachines');

const INCLUDE = {
  seat: { include: { requirement: { include: { account: { select: { id: true, name: true } } } } } },
  profile: {
    select: {
      id: true, name: true, current_company: true, total_experience_years: true,
      primary_skills: true, expected_ctc: true, notice_period_days: true, source: true,
    },
  },
  submitted_by_user: { select: { id: true, name: true } },
  interview_rounds: { orderBy: { round_number: 'asc' } },
};

function serialize(row) {
  if (!row) return null;
  const { requirement_seat_id, profile_id, submitted_by, seat, profile, submitted_by_user, interview_rounds, ...rest } = row;

  return {
    ...rest,
    seat: seat ? { id: seat.id, seat_label: seat.seat_label, requirement_id: seat.requirement_id } : null,
    requirement: seat ? { id: seat.requirement.id, title: seat.requirement.title, account_name: seat.requirement.account.name } : null,
    profile,
    submitted_by: submitted_by_user,
    interview_rounds,
  };
}

async function list(filters) {
  const { requirement_id, seat_id, profile_id, stage, submitted_by, search, sort_by, sort_order, page, limit } = filters;

  const where = {
    ...(requirement_id ? { seat: { requirement_id } } : {}),
    ...(seat_id ? { requirement_seat_id: seat_id } : {}),
    ...(profile_id ? { profile_id } : {}),
    ...(stage ? { stage } : {}),
    ...(submitted_by ? { submitted_by } : {}),
    ...(search
      ? {
          OR: [
            { profile: { name: { contains: search, mode: 'insensitive' } } },
            { seat: { requirement: { title: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const orderBy = sort_by === 'stage' ? { stage: sort_order } : sort_by === 'margin' ? { margin: sort_order } : { created_at: sort_order };

  const [total, rows] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({ where, include: INCLUDE, orderBy, take: limit, skip: (page - 1) * limit }),
  ]);

  return { rows: rows.map(serialize), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await prisma.submission.findUnique({ where: { id }, include: INCLUDE });
  return serialize(row);
}

async function create(data, submittedBy) {
  const seat = await prisma.requirementSeat.findUnique({ where: { id: data.requirement_seat_id } });
  if (!seat) return { error: 'seat_not_found' };
  if (seat.is_locked) return { error: 'seat_locked' };

  const profile = await prisma.profile.findUnique({ where: { id: data.profile_id } });
  if (!profile || !profile.is_active) return { error: 'profile_inactive' };
  if (profile.source === 'vendor' && data.vendor_rate == null) return { error: 'vendor_rate_required' };

  const duplicate = await prisma.submission.findFirst({
    where: { requirement_seat_id: data.requirement_seat_id, profile_id: data.profile_id, stage: { notIn: ['rejected', 'backout'] } },
  });
  if (duplicate) return { error: 'duplicate_submission' };

  const { margin, margin_percentage } = computeMargin(
    data.proposed_rate, data.proposed_rate_currency, data.vendor_rate, data.vendor_rate_currency
  );

  const row = await prisma.submission.create({
    data: { ...data, submitted_by: submittedBy, margin, margin_percentage },
    include: INCLUDE,
  });

  return { submission: serialize(row) };
}

async function update(id, patch) {
  const existing = await prisma.submission.findUnique({ where: { id } });
  const proposed_rate = patch.proposed_rate ?? existing.proposed_rate;
  const proposed_rate_currency = patch.proposed_rate_currency ?? existing.proposed_rate_currency;
  const vendor_rate = patch.vendor_rate ?? existing.vendor_rate;
  const vendor_rate_currency = patch.vendor_rate_currency ?? existing.vendor_rate_currency;
  const { margin, margin_percentage } = computeMargin(proposed_rate, proposed_rate_currency, vendor_rate, vendor_rate_currency);

  const row = await prisma.submission.update({
    where: { id },
    data: { ...patch, margin, margin_percentage },
    include: INCLUDE,
  });
  return serialize(row);
}

async function changeStage(id, { to_stage, reason, backout_reason, rejection_reason }, userId) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({ where: { id } });
    if (!submission) return { error: 'not_found' };
    if (submission.is_locked) return { error: 'locked' };
    if (!(SUBMISSION_STAGE_TRANSITIONS[submission.stage] || []).includes(to_stage)) return { error: 'invalid_transition' };

    if (to_stage === 'backout' && !(backout_reason || reason)) return { error: 'backout_reason_required' };
    if (to_stage === 'rejected' && !(rejection_reason || reason)) return { error: 'rejection_reason_required' };

    if (to_stage === 'offer') {
      const rounds = await tx.interviewRound.findMany({ where: { submission_id: id } });
      const allResolved = rounds.length > 0 && rounds.every((r) => r.result !== 'pending');
      if (!allResolved) return { error: 'rounds_not_resolved' };
    }
    if (to_stage === 'closed') {
      if (submission.bgv_status !== 'cleared') return { error: 'bgv_not_cleared' };
    }

    const patch = { stage: to_stage };
    if (to_stage === 'backout') {
      patch.backout_stage = submission.stage;
      patch.backout_reason = backout_reason || reason;
    }
    if (to_stage === 'rejected') {
      patch.rejection_stage = submission.stage;
      patch.rejection_reason = rejection_reason || reason;
    }
    if (to_stage === 'closed') patch.is_locked = true;

    const updated = await tx.submission.update({ where: { id }, data: patch, include: INCLUDE });

    await tx.stageHistory.create({
      data: {
        entity_type: 'submission',
        entity_id: id,
        from_stage: submission.stage,
        to_stage,
        changed_by: userId,
        reason: reason || backout_reason || rejection_reason || null,
      },
    });

    if (to_stage === 'closed') {
      await tx.requirementSeat.update({
        where: { id: submission.requirement_seat_id },
        data: {
          seat_status: 'closed',
          is_locked: true,
          closed_at: new Date(),
          joined_at: updated.actual_joining_date || new Date(),
        },
      });
    }

    return { submission: serialize(updated) };
  });
}

async function getHistory(id) {
  return prisma.stageHistory.findMany({ where: { entity_type: 'submission', entity_id: id }, orderBy: { changed_at: 'asc' } });
}

async function addInterviewRound(submissionId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!submission) return { error: 'not_found' };

    const last = await tx.interviewRound.findFirst({ where: { submission_id: submissionId }, orderBy: { round_number: 'desc' } });
    const round_number = last ? last.round_number + 1 : 1;

    const payload = { ...data, submission_id: submissionId, round_number };
    if (payload.scheduled_at) payload.scheduled_at = new Date(payload.scheduled_at);
    if (payload.completed_at) payload.completed_at = new Date(payload.completed_at);
    if (['pass', 'fail', 'no_show'].includes(payload.result) && !payload.completed_at) {
      payload.completed_at = new Date();
    }
    if (payload.interviewer_email === '') payload.interviewer_email = null;

    const round = await tx.interviewRound.create({ data: payload });

    if (submission.stage === 'submitted_to_client') {
      await tx.submission.update({ where: { id: submissionId }, data: { stage: 'interview_scheduled' } });
      await tx.stageHistory.create({
        data: {
          entity_type: 'submission',
          entity_id: submissionId,
          from_stage: 'submitted_to_client',
          to_stage: 'interview_scheduled',
          changed_by: userId,
          reason: null,
        },
      });
    }

    // Completing all rounds (including a create that already has a result) can advance to interview_result
    const rounds = await tx.interviewRound.findMany({ where: { submission_id: submissionId } });
    const allResolved = rounds.length > 0 && rounds.every((r) => r.result !== 'pending');
    if (allResolved) {
      const current = await tx.submission.findUnique({ where: { id: submissionId } });
      if (current && current.stage === 'interview_scheduled') {
        await tx.submission.update({ where: { id: submissionId }, data: { stage: 'interview_result' } });
        await tx.stageHistory.create({
          data: {
            entity_type: 'submission',
            entity_id: submissionId,
            from_stage: 'interview_scheduled',
            to_stage: 'interview_result',
            changed_by: userId,
            reason: null,
          },
        });
      }
    }

    return { round };
  });
}

async function updateInterviewRound(id, patch, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interviewRound.findUnique({ where: { id } });
    if (!existing) return { error: 'not_found' };

    const finalPatch = { ...patch };
    if (finalPatch.scheduled_at) finalPatch.scheduled_at = new Date(finalPatch.scheduled_at);
    if (finalPatch.completed_at) finalPatch.completed_at = new Date(finalPatch.completed_at);
    if (finalPatch.interviewer_email === '') finalPatch.interviewer_email = null;
    if (['pass', 'fail', 'no_show'].includes(patch.result) && !patch.completed_at) {
      finalPatch.completed_at = new Date();
    }

    const round = await tx.interviewRound.update({ where: { id }, data: finalPatch });

    const rounds = await tx.interviewRound.findMany({ where: { submission_id: round.submission_id } });
    const allResolved = rounds.every((r) => r.result !== 'pending');
    if (allResolved) {
      const submission = await tx.submission.findUnique({ where: { id: round.submission_id } });
      if (submission && submission.stage === 'interview_scheduled') {
        await tx.submission.update({ where: { id: round.submission_id }, data: { stage: 'interview_result' } });
        await tx.stageHistory.create({
          data: {
            entity_type: 'submission',
            entity_id: round.submission_id,
            from_stage: 'interview_scheduled',
            to_stage: 'interview_result',
            changed_by: userId,
            reason: null,
          },
        });
      }
    }

    return { round };
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  changeStage,
  getHistory,
  addInterviewRound,
  updateInterviewRound,
};
