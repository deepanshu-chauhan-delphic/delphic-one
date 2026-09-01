const prisma = require('../../config/db');
const { SUBMISSION_STAGE_TRANSITIONS, CLIENT_ROUND_TYPES, INTERNAL_ROUND_TYPES, computeMargin, computeMissingMandatoryRounds } = require('./stageMachines');
const { computeClosureDetail } = require('../../utils/closureProgress');

const INTERVIEWER_INCLUDE = {
  interviewers: { include: { user: { select: { id: true, name: true, email: true } } } },
};

const INCLUDE = {
  seat: { include: { requirement: { include: { account: { select: { id: true, name: true } } } } } },
  profile: {
    select: {
      id: true, name: true, current_company: true, total_experience_years: true,
      primary_skills: true, expected_ctc: true, notice_period_days: true, source: true,
      vendor_account: { select: { id: true, name: true } },
    },
  },
  submitted_by_user: { select: { id: true, name: true } },
  interview_rounds: { orderBy: { round_number: 'asc' }, include: INTERVIEWER_INCLUDE },
};

function serializeInterviewRound(round) {
  if (!round) return null;
  const { interviewers, ...rest } = round;
  return {
    ...rest,
    interviewers: (interviewers || []).map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
    })),
  };
}

function serialize(row) {
  if (!row) return null;
  const { requirement_seat_id, profile_id, submitted_by, seat, profile, submitted_by_user, interview_rounds, ...rest } = row;

  return {
    ...rest,
    seat: seat ? { id: seat.id, seat_label: seat.seat_label, requirement_id: seat.requirement_id } : null,
    requirement: seat
      ? { id: seat.requirement.id, title: seat.requirement.title, account_name: seat.requirement.account.name, sales_owner_id: seat.requirement.sales_owner_id }
      : null,
    profile,
    submitted_by: submitted_by_user,
    interview_rounds: interview_rounds ? interview_rounds.map(serializeInterviewRound) : undefined,
    missing_mandatory_rounds: interview_rounds ? computeMissingMandatoryRounds(interview_rounds) : undefined,
    progress: interview_rounds ? computeClosureDetail(row.stage, interview_rounds) : null,
  };
}

async function list(filters) {
  const {
    account_id, requirement_id, seat_id, profile_id, stage, submitted_by, search, sort_by, sort_order, page, limit,
  } = filters;

  const seatFilter = {};
  if (requirement_id) seatFilter.requirement_id = requirement_id;
  if (account_id) seatFilter.requirement = { ...(seatFilter.requirement || {}), account_id };

  const stages = stage
    ? String(stage).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const where = {
    ...(Object.keys(seatFilter).length ? { seat: seatFilter } : {}),
    ...(seat_id ? { requirement_seat_id: seat_id } : {}),
    ...(profile_id ? { profile_id } : {}),
    ...(stages.length ? { stage: { in: stages } } : {}),
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

    if (to_stage === 'offer_sent') {
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

function canManageInterviewRound(submission, requirementSalesOwnerId, roundType, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'recruiter') return submission.submitted_by === user.id;
  if (user.role === 'sales') {
    return CLIENT_ROUND_TYPES.includes(roundType) && requirementSalesOwnerId === user.id;
  }
  return false;
}

async function loadRequirementSalesOwnerId(tx, submission) {
  const seat = await tx.requirementSeat.findUnique({
    where: { id: submission.requirement_seat_id },
    include: { requirement: { select: { sales_owner_id: true } } },
  });
  return seat?.requirement?.sales_owner_id ?? null;
}

async function validateActiveInterviewers(tx, interviewerIds) {
  if (!interviewerIds || interviewerIds.length === 0) return { ok: true };
  const users = await tx.user.findMany({
    where: { id: { in: interviewerIds }, active: true },
    select: { id: true },
  });
  if (users.length !== interviewerIds.length) return { error: 'invalid_interviewers' };
  return { ok: true };
}

async function syncInterviewers(tx, roundId, interviewerIds) {
  if (interviewerIds === undefined) return;
  await tx.interviewRoundInterviewer.deleteMany({ where: { interview_round_id: roundId } });
  if (interviewerIds.length === 0) return;
  await tx.interviewRoundInterviewer.createMany({
    data: interviewerIds.map((user_id) => ({ interview_round_id: roundId, user_id })),
  });
}

async function loadInterviewRound(tx, id) {
  const round = await tx.interviewRound.findUnique({
    where: { id },
    include: INTERVIEWER_INCLUDE,
  });
  return serializeInterviewRound(round);
}

async function addInterviewRound(submissionId, data, user) {
  const userId = user.id;
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUnique({ where: { id: submissionId } });
    if (!submission) return { error: 'not_found' };

    const salesOwnerId = await loadRequirementSalesOwnerId(tx, submission);
    if (!canManageInterviewRound(submission, salesOwnerId, data.round_type, user)) return { error: 'forbidden' };

    const last = await tx.interviewRound.findFirst({ where: { submission_id: submissionId }, orderBy: { round_number: 'desc' } });
    const round_number = last ? last.round_number + 1 : 1;

    const { interviewer_ids, ...roundFields } = data;
    const payload = { ...roundFields, submission_id: submissionId, round_number };
    if (payload.scheduled_at) payload.scheduled_at = new Date(payload.scheduled_at);
    if (payload.completed_at) payload.completed_at = new Date(payload.completed_at);
    if (['pass', 'fail', 'no_show'].includes(payload.result) && !payload.completed_at) {
      payload.completed_at = new Date();
    }
    if (payload.interviewer_email === '') payload.interviewer_email = null;

    if (INTERNAL_ROUND_TYPES.includes(data.round_type) && interviewer_ids !== undefined) {
      const check = await validateActiveInterviewers(tx, interviewer_ids);
      if (check.error) return { error: check.error };
    }

    const created = await tx.interviewRound.create({ data: payload });

    if (INTERNAL_ROUND_TYPES.includes(data.round_type) && interviewer_ids !== undefined) {
      await syncInterviewers(tx, created.id, interviewer_ids);
    }

    const round = await loadInterviewRound(tx, created.id);

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

async function updateInterviewRound(id, patch, user) {
  const userId = user.id;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interviewRound.findUnique({ where: { id } });
    if (!existing) return { error: 'not_found' };

    const submission = await tx.submission.findUnique({ where: { id: existing.submission_id } });
    if (!submission) return { error: 'not_found' };
    const salesOwnerId = await loadRequirementSalesOwnerId(tx, submission);
    if (!canManageInterviewRound(submission, salesOwnerId, existing.round_type, user)) return { error: 'forbidden' };

    const { interviewer_ids, ...patchFields } = patch;
    const finalPatch = { ...patchFields };
    if (finalPatch.scheduled_at) finalPatch.scheduled_at = new Date(finalPatch.scheduled_at);
    if (finalPatch.completed_at) finalPatch.completed_at = new Date(finalPatch.completed_at);
    if (finalPatch.interviewer_email === '') finalPatch.interviewer_email = null;
    if (['pass', 'fail', 'no_show'].includes(patch.result) && !patch.completed_at) {
      finalPatch.completed_at = new Date();
    }

    if (INTERNAL_ROUND_TYPES.includes(existing.round_type) && interviewer_ids !== undefined) {
      const check = await validateActiveInterviewers(tx, interviewer_ids);
      if (check.error) return { error: check.error };
    }

    await tx.interviewRound.update({ where: { id }, data: finalPatch });

    if (INTERNAL_ROUND_TYPES.includes(existing.round_type) && interviewer_ids !== undefined) {
      await syncInterviewers(tx, id, interviewer_ids);
    }

    const round = await loadInterviewRound(tx, id);

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
  canManageInterviewRound,
};
