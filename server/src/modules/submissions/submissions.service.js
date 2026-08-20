const db = require('../../config/db');

const TRANSITIONS = {
  sourced: ['internal_screening', 'rejected', 'backout'],
  internal_screening: ['submitted_to_client', 'rejected', 'backout'],
  submitted_to_client: ['interview_scheduled', 'rejected', 'backout'],
  interview_scheduled: ['interview_result', 'rejected', 'backout'],
  interview_result: ['offer', 'rejected', 'backout'],
  offer: ['bgv', 'backout', 'rejected'],
  bgv: ['closed', 'backout', 'rejected'],
  closed: [],
  backout: [],
  rejected: [],
};

function computeMargin(proposed_rate, proposed_rate_currency, vendor_rate, vendor_rate_currency) {
  if (proposed_rate == null || vendor_rate == null) return { margin: null, margin_percentage: null };
  if (proposed_rate_currency && vendor_rate_currency && proposed_rate_currency !== vendor_rate_currency) {
    return { margin: null, margin_percentage: null };
  }
  const margin = Number(proposed_rate) - Number(vendor_rate);
  const margin_percentage = proposed_rate ? Number(((margin / proposed_rate) * 100).toFixed(2)) : null;
  return { margin, margin_percentage };
}

async function decorate(row) {
  if (!row) return null;
  const [seat, profile, submittedBy, rounds] = await Promise.all([
    db('requirement_seats as rs')
      .join('requirements as r', 'r.id', 'rs.requirement_id')
      .join('accounts as a', 'a.id', 'r.account_id')
      .select('rs.id', 'rs.seat_label', 'rs.requirement_id', 'r.title as requirement_title', 'a.name as account_name')
      .where({ 'rs.id': row.requirement_seat_id })
      .first(),
    db('profiles')
      .select('id', 'name', 'current_company', 'total_experience_years', 'primary_skills', 'expected_ctc', 'notice_period_days', 'source')
      .where({ id: row.profile_id })
      .first(),
    db('users').select('id', 'name').where({ id: row.submitted_by }).first(),
    db('interview_rounds').where({ submission_id: row.id }).orderBy('round_number', 'asc'),
  ]);

  const { requirement_seat_id, profile_id, submitted_by, ...rest } = row;
  return {
    ...rest,
    seat: seat ? { id: seat.id, seat_label: seat.seat_label, requirement_id: seat.requirement_id } : null,
    requirement: seat ? { id: seat.requirement_id, title: seat.requirement_title, account_name: seat.account_name } : null,
    profile,
    submitted_by: submittedBy,
    interview_rounds: rounds,
  };
}

async function list(filters) {
  const { requirement_id, seat_id, profile_id, stage, submitted_by, search, sort_by, sort_order, page, limit } = filters;
  const query = db('submissions as s').join('requirement_seats as rs', 'rs.id', 's.requirement_seat_id');

  if (requirement_id) query.where('rs.requirement_id', requirement_id);
  if (seat_id) query.where('s.requirement_seat_id', seat_id);
  if (profile_id) query.where('s.profile_id', profile_id);
  if (stage) query.where('s.stage', stage);
  if (submitted_by) query.where('s.submitted_by', submitted_by);
  if (search) {
    query
      .join('profiles as p', 'p.id', 's.profile_id')
      .join('requirements as r', 'r.id', 'rs.requirement_id')
      .where((qb) => {
        qb.whereILike('p.name', `%${search}%`).orWhereILike('r.title', `%${search}%`);
      });
  }

  const total = Number((await query.clone().clearSelect().count({ count: 's.id' }).first()).count);
  const rows = await query
    .select('s.*')
    .orderBy(`s.${sort_by === 'stage' ? 'stage' : sort_by === 'margin' ? 'margin' : 'created_at'}`, sort_order)
    .limit(limit)
    .offset((page - 1) * limit);

  const decorated = await Promise.all(rows.map(decorate));
  return { rows: decorated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await db('submissions').where({ id }).first();
  return decorate(row);
}

async function create(data, submittedBy) {
  return db.transaction(async (trx) => {
    const seat = await trx('requirement_seats').where({ id: data.requirement_seat_id }).first();
    if (!seat) return { error: 'seat_not_found' };
    if (seat.is_locked) return { error: 'seat_locked' };

    const profile = await trx('profiles').where({ id: data.profile_id }).first();
    if (!profile || !profile.is_active) return { error: 'profile_inactive' };
    if (profile.source === 'vendor' && data.vendor_rate == null) return { error: 'vendor_rate_required' };

    const duplicate = await trx('submissions')
      .where({ requirement_seat_id: data.requirement_seat_id, profile_id: data.profile_id })
      .whereNotIn('stage', ['rejected', 'backout'])
      .first();
    if (duplicate) return { error: 'duplicate_submission' };

    const { margin, margin_percentage } = computeMargin(
      data.proposed_rate, data.proposed_rate_currency, data.vendor_rate, data.vendor_rate_currency
    );

    const [row] = await trx('submissions')
      .insert({ ...data, submitted_by: submittedBy, margin, margin_percentage })
      .returning('*');

    return { submission: await decorate(row) };
  });
}

async function update(id, patch) {
  const existing = await db('submissions').where({ id }).first();
  const proposed_rate = patch.proposed_rate ?? existing.proposed_rate;
  const proposed_rate_currency = patch.proposed_rate_currency ?? existing.proposed_rate_currency;
  const vendor_rate = patch.vendor_rate ?? existing.vendor_rate;
  const vendor_rate_currency = patch.vendor_rate_currency ?? existing.vendor_rate_currency;
  const { margin, margin_percentage } = computeMargin(proposed_rate, proposed_rate_currency, vendor_rate, vendor_rate_currency);

  const [row] = await db('submissions')
    .where({ id })
    .update({ ...patch, margin, margin_percentage, updated_at: db.fn.now() })
    .returning('*');
  return decorate(row);
}

async function changeStage(id, { to_stage, reason, backout_reason, rejection_reason }, userId) {
  return db.transaction(async (trx) => {
    const submission = await trx('submissions').where({ id }).first();
    if (!submission) return { error: 'not_found' };
    if (submission.is_locked) return { error: 'locked' };
    if (!(TRANSITIONS[submission.stage] || []).includes(to_stage)) return { error: 'invalid_transition' };

    if (to_stage === 'backout' && !(backout_reason || reason)) return { error: 'backout_reason_required' };
    if (to_stage === 'rejected' && !(rejection_reason || reason)) return { error: 'rejection_reason_required' };

    if (to_stage === 'offer') {
      const rounds = await trx('interview_rounds').where({ submission_id: id });
      const allResolved = rounds.length > 0 && rounds.every((r) => r.result !== 'pending');
      if (!allResolved) return { error: 'rounds_not_resolved' };
    }
    if (to_stage === 'closed') {
      if (submission.bgv_status !== 'cleared') return { error: 'bgv_not_cleared' };
    }

    const patch = { stage: to_stage, updated_at: trx.fn.now() };
    if (to_stage === 'backout') {
      patch.backout_stage = submission.stage;
      patch.backout_reason = backout_reason || reason;
    }
    if (to_stage === 'rejected') {
      patch.rejection_stage = submission.stage;
      patch.rejection_reason = rejection_reason || reason;
    }
    if (to_stage === 'closed') patch.is_locked = true;

    const [updated] = await trx('submissions').where({ id }).update(patch).returning('*');

    await trx('stage_history').insert({
      entity_type: 'submission',
      entity_id: id,
      from_stage: submission.stage,
      to_stage,
      changed_by: userId,
      reason: reason || backout_reason || rejection_reason || null,
    });

    if (to_stage === 'closed') {
      await trx('requirement_seats').where({ id: submission.requirement_seat_id }).update({
        seat_status: 'closed',
        is_locked: true,
        closed_at: trx.fn.now(),
        joined_at: updated.actual_joining_date || trx.fn.now(),
      });
    }

    return { submission: await decorate(updated) };
  });
}

async function getHistory(id) {
  return db('stage_history').where({ entity_type: 'submission', entity_id: id }).orderBy('changed_at', 'asc');
}

async function addInterviewRound(submissionId, data) {
  return db.transaction(async (trx) => {
    const submission = await trx('submissions').where({ id: submissionId }).first();
    if (!submission) return { error: 'not_found' };

    const last = await trx('interview_rounds').where({ submission_id: submissionId }).orderBy('round_number', 'desc').first();
    const round_number = last ? last.round_number + 1 : 1;

    const [round] = await trx('interview_rounds').insert({ ...data, submission_id: submissionId, round_number }).returning('*');

    if (submission.stage === 'submitted_to_client') {
      await trx('submissions').where({ id: submissionId }).update({ stage: 'interview_scheduled', updated_at: trx.fn.now() });
    }

    return { round };
  });
}

async function updateInterviewRound(id, patch) {
  return db.transaction(async (trx) => {
    const existing = await trx('interview_rounds').where({ id }).first();
    if (!existing) return { error: 'not_found' };

    const finalPatch = { ...patch };
    if (['pass', 'fail', 'no_show'].includes(patch.result) && !patch.completed_at) {
      finalPatch.completed_at = trx.fn.now();
    }

    const [round] = await trx('interview_rounds').where({ id }).update(finalPatch).returning('*');

    const rounds = await trx('interview_rounds').where({ submission_id: round.submission_id });
    const allResolved = rounds.every((r) => r.result !== 'pending');
    if (allResolved) {
      const submission = await trx('submissions').where({ id: round.submission_id }).first();
      if (submission && submission.stage === 'interview_scheduled') {
        await trx('submissions').where({ id: round.submission_id }).update({ stage: 'interview_result', updated_at: trx.fn.now() });
      }
    }

    return { round };
  });
}

async function getInterviewRounds(submissionId) {
  return db('interview_rounds').where({ submission_id: submissionId }).orderBy('round_number', 'asc');
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
  getInterviewRounds,
};
