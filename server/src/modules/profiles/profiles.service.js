const db = require('../../config/db');

async function decorate(row) {
  if (!row) return null;
  const [vendor, addedBy, counts] = await Promise.all([
    row.vendor_account_id ? db('accounts').select('id', 'name').where({ id: row.vendor_account_id }).first() : null,
    db('users').select('id', 'name').where({ id: row.added_by }).first(),
    db('submissions').select('stage').count({ total: '*' }).where({ profile_id: row.id }).groupBy('stage'),
  ]);

  const total_submissions_count = counts.reduce((sum, c) => sum + Number(c.total), 0);
  const active_submissions_count = counts
    .filter((c) => !['rejected', 'backout', 'closed'].includes(c.stage))
    .reduce((sum, c) => sum + Number(c.total), 0);

  const { vendor_account_id, added_by, ...rest } = row;
  return {
    ...rest,
    vendor_account: vendor,
    added_by: addedBy,
    total_submissions_count,
    active_submissions_count,
  };
}

async function list(filters) {
  const {
    source, vendor_id, primary_skills, experience_min, experience_max, expected_ctc_min, expected_ctc_max,
    notice_period_max, is_serving_notice, current_location, willing_to_relocate, preferred_work_mode,
    is_active, added_by, search, sort_by, sort_order, page, limit,
  } = filters;

  const query = db('profiles');

  if (source) query.where({ source });
  if (vendor_id) query.where({ vendor_account_id: vendor_id });
  if (experience_min !== undefined) query.where('total_experience_years', '>=', experience_min);
  if (experience_max !== undefined) query.where('total_experience_years', '<=', experience_max);
  if (expected_ctc_min !== undefined) query.where('expected_ctc', '>=', expected_ctc_min);
  if (expected_ctc_max !== undefined) query.where('expected_ctc', '<=', expected_ctc_max);
  if (notice_period_max !== undefined) query.where('notice_period_days', '<=', notice_period_max);
  if (is_serving_notice !== undefined) query.where({ is_serving_notice });
  if (current_location) query.whereILike('current_location', `%${current_location}%`);
  if (willing_to_relocate !== undefined) query.where({ willing_to_relocate });
  if (preferred_work_mode) query.where({ preferred_work_mode });
  if (is_active !== undefined) query.where({ is_active });
  if (added_by) query.where({ added_by });
  if (primary_skills) {
    const skills = primary_skills.split(',').map((s) => s.trim());
    query.where('primary_skills', '&&', skills);
  }
  if (search) {
    query.where((qb) => {
      qb.whereILike('name', `%${search}%`)
        .orWhereILike('email', `%${search}%`)
        .orWhereILike('phone', `%${search}%`)
        .orWhereILike('current_company', `%${search}%`);
    });
  }

  const total = Number((await query.clone().count({ count: '*' }).first()).count);
  const rows = await query.orderBy(sort_by, sort_order).limit(limit).offset((page - 1) * limit);
  const decorated = await Promise.all(rows.map(decorate));

  return { rows: decorated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getById(id) {
  const row = await db('profiles').where({ id }).first();
  return decorate(row);
}

async function create(data, addedBy) {
  const [row] = await db('profiles').insert({ ...data, added_by: addedBy }).returning('*');
  return decorate(row);
}

async function update(id, patch) {
  const [row] = await db('profiles').where({ id }).update({ ...patch, updated_at: db.fn.now() }).returning('*');
  return decorate(row);
}

async function getSubmissions(profileId) {
  const rows = await db('submissions as s')
    .join('requirement_seats as rs', 'rs.id', 's.requirement_seat_id')
    .join('requirements as r', 'r.id', 'rs.requirement_id')
    .join('accounts as a', 'a.id', 'r.account_id')
    .select(
      's.id', 's.stage', 's.proposed_rate', 's.created_at',
      'r.id as requirement_id', 'r.title as requirement_title', 'a.name as account_name',
      'rs.id as seat_id', 'rs.seat_label'
    )
    .where({ 's.profile_id': profileId })
    .orderBy('s.created_at', 'desc');

  return rows.map((r) => ({
    id: r.id,
    stage: r.stage,
    requirement: { id: r.requirement_id, title: r.requirement_title, account_name: r.account_name },
    seat: { id: r.seat_id, seat_label: r.seat_label },
    proposed_rate: r.proposed_rate,
    created_at: r.created_at,
  }));
}

module.exports = { list, getById, create, update, getSubmissions };
