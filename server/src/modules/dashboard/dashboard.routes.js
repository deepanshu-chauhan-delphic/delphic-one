const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const db = require('../../config/db');

const router = express.Router();
router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      leads_active, leads_in_meeting, clients_active, vendors_active,
      requirements_open, requirements_in_progress, requirements_closed_this_month,
      submissions_active, interviews_scheduled_this_week, closures_this_month,
      funnelRows, recentHistory,
    ] = await Promise.all([
      db('accounts').where({ type: 'client', stage: 'lead' }).count({ c: '*' }).first(),
      db('accounts').where({ stage: 'meeting_scheduled' }).count({ c: '*' }).first(),
      db('accounts').where({ type: 'client', stage: 'active' }).count({ c: '*' }).first(),
      db('accounts').where({ type: 'vendor', stage: 'active' }).count({ c: '*' }).first(),
      db('requirements').where({ status: 'open' }).count({ c: '*' }).first(),
      db('requirements').where({ status: 'in_progress' }).count({ c: '*' }).first(),
      db('requirements').where({ status: 'closed' }).where('closed_at', '>=', startOfMonth).count({ c: '*' }).first(),
      db('submissions').whereNotIn('stage', ['closed', 'rejected', 'backout']).count({ c: '*' }).first(),
      db('interview_rounds').where('scheduled_at', '>=', startOfWeek).count({ c: '*' }).first(),
      db('submissions').where('actual_joining_date', '>=', startOfMonth.toISOString().slice(0, 10)).count({ c: '*' }).first(),
      db('submissions').select('stage').count({ c: '*' }).groupBy('stage'),
      db('stage_history as sh')
        .join('users as u', 'u.id', 'sh.changed_by')
        .select('sh.entity_type', 'sh.entity_id', 'sh.to_stage', 'sh.changed_at', 'u.id as user_id', 'u.name as user_name')
        .orderBy('sh.changed_at', 'desc')
        .limit(10),
    ]);

    const funnelMap = Object.fromEntries(funnelRows.map((r) => [r.stage, Number(r.c)]));

    return ok(res, {
      leads_active: Number(leads_active.c),
      leads_in_meeting: Number(leads_in_meeting.c),
      clients_active: Number(clients_active.c),
      vendors_active: Number(vendors_active.c),
      requirements_open: Number(requirements_open.c),
      requirements_in_progress: Number(requirements_in_progress.c),
      requirements_closed_this_month: Number(requirements_closed_this_month.c),
      submissions_active: Number(submissions_active.c),
      interviews_scheduled_this_week: Number(interviews_scheduled_this_week.c),
      closures_this_month: Number(closures_this_month.c),
      stuck_leads: [],
      stuck_requirements: [],
      recent_activity: recentHistory.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        entity_label: r.entity_type,
        action: `stage changed to ${r.to_stage}`,
        user: { id: r.user_id, name: r.user_name },
        timestamp: r.changed_at,
      })),
      pipeline_funnel: {
        sourced: funnelMap.sourced || 0,
        screening: funnelMap.internal_screening || 0,
        submitted: funnelMap.submitted_to_client || 0,
        interviewing: funnelMap.interview_scheduled || 0,
        offered: funnelMap.offer || 0,
        bgv: funnelMap.bgv || 0,
        closed: funnelMap.closed || 0,
      },
    });
  })
);

module.exports = router;
