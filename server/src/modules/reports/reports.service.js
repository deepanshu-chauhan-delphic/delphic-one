const db = require('../../config/db');

async function recruiterPerformance({ date_from, date_to, recruiter_id }) {
  const recruiters = recruiter_id
    ? await db('users').where({ id: recruiter_id, role: 'recruiter' })
    : await db('users').where({ role: 'recruiter' });

  return Promise.all(
    recruiters.map(async (r) => {
      const profilesQuery = db('profiles').where({ added_by: r.id }).whereBetween('created_at', [date_from, date_to]);
      const bySource = await profilesQuery.clone().select('source').count({ c: '*' }).groupBy('source');
      const sourceMap = Object.fromEntries(bySource.map((x) => [x.source, Number(x.c)]));

      const submissions = await db('submissions')
        .where({ submitted_by: r.id })
        .whereBetween('created_at', [date_from, date_to]);

      const byStage = submissions.reduce((acc, s) => {
        acc[s.stage] = (acc[s.stage] || 0) + 1;
        return acc;
      }, {});

      const closures = submissions.filter((s) => s.actual_joining_date && s.actual_joining_date >= date_from && s.actual_joining_date <= date_to);
      const backouts = submissions.filter((s) => s.stage === 'backout').length;

      const requirementIds = new Set(
        (
          await db('requirement_seats')
            .whereIn('id', submissions.map((s) => s.requirement_seat_id))
        ).map((s) => s.requirement_id)
      );

      return {
        recruiter: { id: r.id, name: r.name },
        profiles_sourced: Number((await profilesQuery.clone().count({ c: '*' }).first()).c),
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
        avg_days_sourced_to_submitted: null,
        avg_days_submitted_to_interview: null,
        avg_days_interview_to_offer: null,
        avg_days_offer_to_closed: null,
        avg_days_total_cycle: null,
        requirements_worked_on: requirementIds.size,
        closures_count: closures.length,
      };
    })
  );
}

async function salesPerformance({ date_from, date_to, sales_id }) {
  const salesUsers = sales_id ? await db('users').where({ id: sales_id, role: 'sales' }) : await db('users').where({ role: 'sales' });

  return Promise.all(
    salesUsers.map(async (s) => {
      const leads = await db('accounts').where({ owner_id: s.id, type: 'client' }).whereBetween('created_at', [date_from, date_to]);
      const leads_converted_active = leads.filter((l) => l.stage === 'active').length;
      const leads_dropped = leads.filter((l) => l.stage === 'dropped').length;

      const requirements = await db('requirements').where({ sales_owner_id: s.id }).whereBetween('created_at', [date_from, date_to]);
      const requirements_closed = requirements.filter((r) => r.status === 'closed');
      const requirements_dropped = requirements.filter((r) => r.status === 'dropped').length;
      const requirements_in_progress = requirements.filter((r) => r.status === 'in_progress').length;

      const closedSeatIds = (
        await db('requirement_seats').whereIn(
          'requirement_id',
          requirements_closed.map((r) => r.id)
        )
      ).map((s2) => s2.id);

      const closedSubmissions = closedSeatIds.length
        ? await db('submissions').whereIn('requirement_seat_id', closedSeatIds).where({ stage: 'closed' })
        : [];

      const total_closed_revenue = closedSubmissions.reduce((sum, x) => sum + Number(x.final_agreed_rate || 0), 0);
      const total_margin_generated = closedSubmissions.reduce((sum, x) => sum + Number(x.margin || 0), 0);

      const openRequirements = requirements.filter((r) => r.status === 'open' || r.status === 'in_progress');
      const total_budget_pipeline = openRequirements.reduce((sum, r) => sum + Number(r.budget_max || 0), 0);

      const clients_active = await db('accounts').where({ owner_id: s.id, type: 'client', stage: 'active' }).count({ c: '*' }).first();

      let avg_closure_days = null;
      if (requirements_closed.length) {
        const days = requirements_closed
          .filter((r) => r.closed_at)
          .map((r) => (new Date(r.closed_at) - new Date(r.created_at)) / 86400000);
        avg_closure_days = days.length ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)) : null;
      }

      return {
        sales_person: { id: s.id, name: s.name },
        leads_created: leads.length,
        leads_converted_active,
        leads_dropped,
        conversion_rate_percentage: leads.length ? Number(((leads_converted_active / leads.length) * 100).toFixed(2)) : 0,
        requirements_opened: requirements.length,
        requirements_closed: requirements_closed.length,
        requirements_dropped,
        requirements_in_progress,
        avg_closure_days,
        total_budget_pipeline,
        total_closed_revenue,
        total_margin_generated,
        clients_active: Number(clients_active.c),
      };
    })
  );
}

async function vendorPerformance({ date_from, date_to, vendor_id }) {
  const vendors = vendor_id
    ? await db('accounts').where({ id: vendor_id, type: 'vendor' })
    : await db('accounts').where({ type: 'vendor' });

  return Promise.all(
    vendors.map(async (v) => {
      const profileIds = (await db('profiles').where({ vendor_account_id: v.id })).map((p) => p.id);
      const submissions = profileIds.length
        ? await db('submissions').whereIn('profile_id', profileIds).whereBetween('created_at', [date_from, date_to])
        : [];

      const shortlisted = submissions.filter((s) => !['sourced', 'internal_screening'].includes(s.stage)).length;
      const interviewed = submissions.filter((s) => ['interview_scheduled', 'interview_result', 'offer', 'bgv', 'closed'].includes(s.stage)).length;
      const offered = submissions.filter((s) => ['offer', 'bgv', 'closed'].includes(s.stage)).length;
      const closed = submissions.filter((s) => s.stage === 'closed');
      const backout = submissions.filter((s) => s.stage === 'backout').length;

      const margins = closed.map((s) => Number(s.margin || 0));
      const total_margin = margins.reduce((a, b) => a + b, 0);

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
        avg_days_to_submit: null,
        reliability_score: submissions.length ? Number(((closed.length / submissions.length) * 100).toFixed(2)) : null,
      };
    })
  );
}

async function aging({ threshold_days = 7 }) {
  const cutoff = new Date(Date.now() - threshold_days * 86400000);

  const stuckLeadsRaw = await db('accounts as a')
    .join('users as u', 'u.id', 'a.owner_id')
    .select('a.id', 'a.name', 'a.stage', 'a.updated_at', 'u.id as owner_id', 'u.name as owner_name')
    .whereIn('a.stage', ['lead', 'meeting_scheduled', 'rescheduled'])
    .where('a.updated_at', '<=', cutoff);

  const stuckReqsRaw = await db('requirements as r')
    .join('users as u', 'u.id', 'r.sales_owner_id')
    .select('r.id', 'r.title', 'r.status', 'r.priority', 'r.created_at', 'u.id as owner_id', 'u.name as owner_name')
    .whereIn('r.status', ['open', 'in_progress'])
    .where('r.created_at', '<=', cutoff);

  const stuckReqs = await Promise.all(
    stuckReqsRaw.map(async (r) => {
      const seatIds = (await db('requirement_seats').where({ requirement_id: r.id })).map((s) => s.id);
      const submissions_count = seatIds.length
        ? Number((await db('submissions').whereIn('requirement_seat_id', seatIds).count({ c: '*' }).first()).c)
        : 0;
      const lastSubmission = seatIds.length
        ? await db('submissions').whereIn('requirement_seat_id', seatIds).orderBy('created_at', 'desc').first()
        : null;

      return {
        requirement: { id: r.id, title: r.title, status: r.status, priority: r.priority },
        sales_owner: { id: r.owner_id, name: r.owner_name },
        days_open: Math.floor((Date.now() - new Date(r.created_at)) / 86400000),
        submissions_count,
        last_submission_date: lastSubmission ? lastSubmission.created_at : null,
      };
    })
  );

  const stuckSubmissionsRaw = await db('submissions as s')
    .join('requirement_seats as rs', 'rs.id', 's.requirement_seat_id')
    .join('requirements as r', 'r.id', 'rs.requirement_id')
    .join('profiles as p', 'p.id', 's.profile_id')
    .join('users as u', 'u.id', 's.submitted_by')
    .select('s.id', 's.stage', 's.updated_at', 'p.id as profile_id', 'p.name as profile_name', 'r.id as req_id', 'r.title as req_title', 'u.id as recruiter_id', 'u.name as recruiter_name')
    .whereNotIn('s.stage', ['closed', 'rejected', 'backout'])
    .where('s.updated_at', '<=', cutoff);

  const pastSlaRaw = await db('requirements')
    .whereNotNull('sla_days')
    .whereIn('status', ['open', 'in_progress']);

  return {
    stuck_leads: stuckLeadsRaw.map((l) => ({
      account: { id: l.id, name: l.name, stage: l.stage },
      owner: { id: l.owner_id, name: l.owner_name },
      days_in_stage: Math.floor((Date.now() - new Date(l.updated_at)) / 86400000),
      last_activity: l.updated_at,
    })),
    stuck_requirements: stuckReqs,
    stuck_submissions: stuckSubmissionsRaw.map((s) => ({
      submission: { id: s.id, stage: s.stage },
      profile: { id: s.profile_id, name: s.profile_name },
      requirement: { id: s.req_id, title: s.req_title },
      recruiter: { id: s.recruiter_id, name: s.recruiter_name },
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

async function closure({ date_from, date_to, group_by = 'month' }) {
  const rows = await db('submissions as s')
    .join('requirement_seats as rs', 'rs.id', 's.requirement_seat_id')
    .join('requirements as r', 'r.id', 'rs.requirement_id')
    .join('accounts as a', 'a.id', 'r.account_id')
    .join('profiles as p', 'p.id', 's.profile_id')
    .join('users as u', 'u.id', 's.submitted_by')
    .select(
      's.id', 's.actual_joining_date', 's.final_agreed_rate', 's.margin', 's.created_at',
      'r.id as req_id', 'r.title as req_title', 'a.id as client_id', 'a.name as client_name',
      'p.id as profile_id', 'p.name as profile_name', 'u.id as recruiter_id', 'u.name as recruiter_name'
    )
    .where({ 's.stage': 'closed' })
    .whereBetween('s.actual_joining_date', [date_from, date_to]);

  const groupKey = (row) => {
    const d = new Date(row.actual_joining_date);
    if (group_by === 'client') return row.client_name;
    if (group_by === 'recruiter') return row.recruiter_name;
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
        requirement: { id: x.req_id, title: x.req_title },
        client: { id: x.client_id, name: x.client_name },
        profile: { id: x.profile_id, name: x.profile_name },
        joined_at: x.actual_joining_date,
        final_agreed_rate: x.final_agreed_rate,
        margin: x.margin,
        recruiter: { id: x.recruiter_id, name: x.recruiter_name },
      })),
    };
  });
}

module.exports = { recruiterPerformance, salesPerformance, vendorPerformance, aging, closure };
