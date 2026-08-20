const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { ok } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const prisma = require('../../config/db');

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
      prisma.account.count({ where: { type: 'client', stage: 'lead' } }),
      prisma.account.count({ where: { stage: 'meeting_scheduled' } }),
      prisma.account.count({ where: { type: 'client', stage: 'active' } }),
      prisma.account.count({ where: { type: 'vendor', stage: 'active' } }),
      prisma.requirement.count({ where: { status: 'open' } }),
      prisma.requirement.count({ where: { status: 'in_progress' } }),
      prisma.requirement.count({ where: { status: 'closed', closed_at: { gte: startOfMonth } } }),
      prisma.submission.count({ where: { stage: { notIn: ['closed', 'rejected', 'backout'] } } }),
      prisma.interviewRound.count({ where: { scheduled_at: { gte: startOfWeek } } }),
      prisma.submission.count({ where: { actual_joining_date: { gte: startOfMonth } } }),
      prisma.submission.groupBy({ by: ['stage'], _count: { id: true } }),
      prisma.stageHistory.findMany({
        orderBy: { changed_at: 'desc' },
        take: 10,
        include: { changed_by_user: { select: { id: true, name: true } } },
      }),
    ]);

    const funnelMap = Object.fromEntries(funnelRows.map((r) => [r.stage, r._count.id]));

    return ok(res, {
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
      stuck_leads: [],
      stuck_requirements: [],
      recent_activity: recentHistory.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        entity_label: r.entity_type,
        action: `stage changed to ${r.to_stage}`,
        user: r.changed_by_user,
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
