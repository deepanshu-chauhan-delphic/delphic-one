const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

// --- Global soft-delete filter -------------------------------------------------
// The 5 models below carry `deleted_at` (see schema.prisma + the admin module).
// A superadmin "delete" only stamps that column; every ordinary read must skip
// stamped rows. There is no raw SQL anywhere in the codebase, so a single
// middleware covers all read paths (lists, counts, reports, dashboard, …).
//
// Escape hatch: pass an explicit `deleted_at` in the `where` (the admin service
// does this to load / restore deleted rows) and the middleware leaves it alone.
//
// Known limitation: `$use` does NOT rewrite nested relation reads, so a
// soft-deleted parent can still appear via an existing child's `include`. That
// is acceptable here — deleted records are duplicates / terminal, and the
// top-level lists + reports are what matter.
const SOFT_DELETE_MODELS = new Set(['Account', 'Requirement', 'Submission', 'Profile', 'InterviewRound']);
const READ_ACTIONS = new Set(['findFirst', 'findMany', 'count', 'aggregate', 'groupBy']);

function mentionsDeletedAt(where) {
  if (!where || typeof where !== 'object') return false;
  if ('deleted_at' in where) return true;
  for (const key of ['AND', 'OR', 'NOT']) {
    const branch = where[key];
    if (Array.isArray(branch) && branch.some(mentionsDeletedAt)) return true;
    if (branch && !Array.isArray(branch) && mentionsDeletedAt(branch)) return true;
  }
  return false;
}

prisma.$use(async (params, next) => {
  if (!SOFT_DELETE_MODELS.has(params.model)) return next(params);

  // findUnique can't take a non-unique filter — promote it so we can add ours.
  if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
    params.action = params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
    params.args = params.args || {};
    if (!mentionsDeletedAt(params.args.where)) {
      params.args.where = { ...params.args.where, deleted_at: null };
    }
    return next(params);
  }

  if (READ_ACTIONS.has(params.action)) {
    params.args = params.args || {};
    if (!mentionsDeletedAt(params.args.where)) {
      params.args.where = { ...(params.args.where || {}), deleted_at: null };
    }
  }

  return next(params);
});

module.exports = prisma;
